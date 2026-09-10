import { useMemo, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import { useApiData } from '../hooks/useApiData.js';
import { useRealtimeRefetch } from '../hooks/useRealtimeRefetch.js';
import { useModal } from '../context/ModalContext.js';
import { useToast } from '../context/ToastContext.js';
import { formatDateInZone, formatTimeInZone } from '../lib/time.js';
import type { Assignment, Location, Shift, SwapRequest, SwapStatus, User } from '../api/types.js';

const STATUS_LABEL: Record<SwapStatus, string> = {
  pending_target: 'Awaiting staff response', open: 'Open — on the marketplace',
  pending_manager: 'Awaiting your approval', approved: 'Approved', rejected: 'Rejected',
  cancelled: 'Cancelled', expired: 'Expired unclaimed',
};

interface ShiftsResponse { shifts: Shift[]; assignments: Assignment[] }

function RejectForm({ swapId, onDone }: { swapId: string; onDone: () => void }) {
  const { closeModal } = useModal();
  const showToast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/swap-requests/${swapId}/decide`, { approve: false, reason });
      showToast('Request rejected.', 'info');
      onDone();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not process that request.');
    }
  }

  return (
    <>
      <p className="eyebrow">REJECT REQUEST</p>
      <h2>Reason for rejecting</h2>
      <form className="form-grid" onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <label>Reason (shown to the requester)
          <textarea rows={3} required value={reason} onChange={e => setReason(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={closeModal}>Cancel</button>
          <button type="submit" className="danger-btn">Reject request</button>
        </div>
      </form>
    </>
  );
}

export default function CoveragePage() {
  const showToast = useToast();
  const { openModal } = useModal();
  const { data: requests, reload: reloadRequests } = useApiData(() => api.get<SwapRequest[]>('/swap-requests'), []);
  const { data: shiftsData, reload: reloadShifts } = useApiData(() => api.get<ShiftsResponse>('/shifts'), []);
  const { data: locations } = useApiData(() => api.get<Location[]>('/locations'), []);
  const { data: staff } = useApiData(() => api.get<User[]>('/users'), []);

  useRealtimeRefetch(() => { reloadRequests(); reloadShifts(); });

  const assignmentsById = useMemo(() => new Map((shiftsData?.assignments ?? []).map(a => [a.id, a])), [shiftsData]);
  const shiftsById = useMemo(() => new Map((shiftsData?.shifts ?? []).map(s => [s.id, s])), [shiftsData]);
  const locationsById = useMemo(() => new Map((locations ?? []).map(l => [l.id, l])), [locations]);
  const staffById = useMemo(() => new Map((staff ?? []).map(u => [u.id, u])), [staff]);

  function context(req: SwapRequest) {
    const assignment = assignmentsById.get(req.assignmentId);
    const shift = assignment ? shiftsById.get(assignment.shiftId) : undefined;
    const location = shift ? locationsById.get(shift.locationId) : undefined;
    return { assignment, shift, location };
  }

  const all = requests ?? [];
  const sections: { key: string; title: string; items: SwapRequest[] }[] = [
    { key: 'pending_manager', title: 'Awaiting your approval', items: all.filter(r => r.status === 'pending_manager') },
    { key: 'pending_target', title: 'Awaiting staff response', items: all.filter(r => r.status === 'pending_target') },
    { key: 'open', title: 'Open on the marketplace', items: all.filter(r => r.status === 'open') },
    { key: 'resolved', title: 'Recently resolved', items: all.filter(r => ['approved', 'rejected', 'cancelled', 'expired'].includes(r.status)).slice(0, 8) },
  ];

  async function approve(swapId: string) {
    try {
      await api.post(`/swap-requests/${swapId}/decide`, { approve: true });
      showToast('Swap approved — both parties notified.', 'success');
      reloadRequests(); reloadShifts();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not process that request.', 'warning');
    }
  }

  function reject(swapId: string) {
    openModal(<RejectForm swapId={swapId} onDone={() => { reloadRequests(); reloadShifts(); }} />);
  }

  return (
    <>
      {sections.map(section => (
        <div key={section.key}>
          <section className="section-title">
            <div><p className="eyebrow">{section.key === 'pending_manager' ? 'ACTION NEEDED' : 'STATUS'}</p><h2>{section.title}</h2></div>
            <span>{section.items.length} request{section.items.length === 1 ? '' : 's'}</span>
          </section>
          <div className="table">
            <div className="thead"><span>REQUEST</span><span>SHIFT</span><span>PARTIES</span><span>STATUS</span></div>
            {section.items.length === 0 && <p className="empty">Nothing here.</p>}
            {section.items.map(req => {
              const { shift, location } = context(req);
              if (!shift || !location) return null;
              const requester = staffById.get(req.requesterId);
              const target = req.targetStaffId ? staffById.get(req.targetStaffId) : null;
              const parties = req.type === 'drop'
                ? `${requester?.name} dropping${target ? ` → claimed by ${target.name}` : ''}`
                : `${requester?.name} → ${target ? target.name : '—'}`;
              return (
                <div key={req.id} className={`row ${section.key === 'pending_manager' ? 'alert' : ''}`}>
                  <div className="shift-name">
                    <i className={`shift-dot ${req.type === 'swap' ? 'purple' : 'coral'}`} />
                    <div><strong>{req.type === 'swap' ? 'Swap' : 'Drop'} request</strong><small>Filed {new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></div>
                  </div>
                  <div>{shift.skill}<small>{location.name} · {formatDateInZone(shift.start, location.timezone)} {formatTimeInZone(shift.start, location.timezone)}</small></div>
                  <div>{parties}</div>
                  <div className="row-status">
                    <label className={req.status === 'pending_manager' ? 'pending' : req.status === 'approved' ? 'good' : ''}>{STATUS_LABEL[req.status]}</label>
                    {section.key === 'pending_manager' && (
                      <>
                        <button className="link small" onClick={() => approve(req.id)}>Approve</button>
                        <button className="link small danger-text" onClick={() => reject(req.id)}>Reject</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

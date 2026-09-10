import { useMemo } from 'react';
import { api, ApiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useApiData } from '../../hooks/useApiData.js';
import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { useToast } from '../../context/ToastContext.js';
import { formatDateInZone } from '../../lib/time.js';
import type { Assignment, Location, Shift, SwapRequest, User } from '../../api/types.js';

interface ShiftsResponse { shifts: Shift[]; assignments: Assignment[] }

export default function MySwapsPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const { data: swaps, reload } = useApiData(() => api.get<SwapRequest[]>('/swap-requests'), []);
  const { data: shiftsData } = useApiData(() => api.get<ShiftsResponse>('/shifts'), []);
  const { data: locations } = useApiData(() => api.get<Location[]>('/locations'), []);
  const { data: staff } = useApiData(() => api.get<User[]>('/users'), []);
  useRealtimeRefetch(reload);

  const shiftsById = useMemo(() => new Map((shiftsData?.shifts ?? []).map(s => [s.id, s])), [shiftsData]);
  const assignmentsById = useMemo(() => new Map((shiftsData?.assignments ?? []).map(a => [a.id, a])), [shiftsData]);
  const locationsById = useMemo(() => new Map((locations ?? []).map(l => [l.id, l])), [locations]);
  const staffById = useMemo(() => new Map((staff ?? []).map(u => [u.id, u])), [staff]);

  function shiftInfo(req: SwapRequest) {
    const assignment = assignmentsById.get(req.assignmentId);
    const shift = assignment ? shiftsById.get(assignment.shiftId) : undefined;
    const location = shift ? locationsById.get(shift.locationId) : undefined;
    return { shift, location };
  }

  const filed = (swaps ?? []).filter(r => r.requesterId === user?.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const incoming = (swaps ?? []).filter(r => r.targetStaffId === user?.id && r.status === 'pending_target');

  async function accept(id: string) {
    try {
      await api.post(`/swap-requests/${id}/accept`);
      showToast('Accepted — waiting on manager approval.', 'success');
      reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not process that request.', 'warning');
    }
  }
  async function decline(id: string) {
    try {
      await api.post(`/swap-requests/${id}/decline`);
      showToast('Declined.', 'info');
      reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not process that request.', 'warning');
    }
  }
  async function cancel(id: string) {
    const ok = await confirm({ title: 'Cancel this request?', body: 'Your original shift stays exactly as it was — nothing changes until you file again.', confirmLabel: 'Cancel request', danger: true });
    if (!ok) return;
    try {
      await api.post(`/swap-requests/${id}/cancel`);
      showToast('Request cancelled.', 'info');
      reload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not process that request.', 'warning');
    }
  }

  return (
    <>
      {incoming.length > 0 && (
        <>
          <section className="section-title"><div><p className="eyebrow">ACTION NEEDED</p><h2>Swap requests for you</h2></div></section>
          <div className="table">
            <div className="thead"><span>FROM</span><span>SHIFT</span><span>TIME</span><span>ACTION</span></div>
            {incoming.map(r => {
              const { shift, location } = shiftInfo(r);
              const requester = staffById.get(r.requesterId);
              if (!shift || !location) return null;
              return (
                <div className="row alert" key={r.id}>
                  <div>{requester?.name}</div>
                  <div>{shift.skill}<small>{location.name}</small></div>
                  <div>{formatDateInZone(shift.start, location.timezone)}</div>
                  <div><button className="primary small" onClick={() => accept(r.id)}>Accept</button> <button className="ghost small" onClick={() => decline(r.id)}>Decline</button></div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <section className="section-title"><div><p className="eyebrow">YOUR REQUESTS</p><h2>Swap &amp; drop history</h2></div></section>
      <div className="table">
        <div className="thead"><span>TYPE</span><span>SHIFT</span><span>STATUS</span><span>ACTION</span></div>
        {filed.length === 0 && <p className="empty">You haven&rsquo;t filed any swap or drop requests.</p>}
        {filed.map(r => {
          const { shift, location } = shiftInfo(r);
          if (!shift || !location) return null;
          const cancellable = ['pending_target', 'open', 'pending_manager'].includes(r.status);
          return (
            <div className="row" key={r.id}>
              <div>{r.type === 'swap' ? 'Swap' : 'Drop'}</div>
              <div>{shift.skill}<small>{location.name} · {formatDateInZone(shift.start, location.timezone)}</small></div>
              <div>
                <label className={r.status === 'approved' ? 'good' : cancellable ? 'pending' : ''}>{r.status.replace('_', ' ')}</label>
                {r.reason ? <small>{r.reason}</small> : null}
              </div>
              <div>{cancellable ? <button className="link small" onClick={() => cancel(r.id)}>Cancel</button> : null}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

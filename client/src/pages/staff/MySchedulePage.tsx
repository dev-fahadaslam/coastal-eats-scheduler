import { useMemo } from 'react';
import { api, ApiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useApiData } from '../../hooks/useApiData.js';
import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch.js';
import { useModal } from '../../context/ModalContext.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { useToast } from '../../context/ToastContext.js';
import { CoverageModalContent } from '../../components/CoverageModalContent.js';
import { formatDateInZone, formatTimeInZone } from '../../lib/time.js';
import { MAX_PENDING_REQUESTS } from '../../lib/rules.js';
import type { Assignment, Location, Shift, SwapRequest } from '../../api/types.js';

interface ShiftsResponse { shifts: Shift[]; assignments: Assignment[] }

export default function MySchedulePage() {
  const { user } = useAuth();
  const { openModal } = useModal();
  const confirm = useConfirm();
  const showToast = useToast();

  const { data: shiftsData, reload: reloadShifts } = useApiData(() => api.get<ShiftsResponse>('/shifts'), []);
  const { data: locations } = useApiData(() => api.get<Location[]>('/locations'), []);
  const { data: swaps, reload: reloadSwaps } = useApiData(() => api.get<SwapRequest[]>('/swap-requests'), []);
  useRealtimeRefetch(() => { reloadShifts(); reloadSwaps(); });

  const locationsById = useMemo(() => new Map((locations ?? []).map(l => [l.id, l])), [locations]);
  const shiftsById = useMemo(() => new Map((shiftsData?.shifts ?? []).map(s => [s.id, s])), [shiftsData]);

  const myAssignments = (shiftsData?.assignments ?? [])
    .filter(a => a.staffId === user?.id && a.status === 'assigned')
    .map(a => ({ assignment: a, shift: shiftsById.get(a.shiftId) }))
    .filter((x): x is { assignment: Assignment; shift: Shift } => Boolean(x.shift))
    .sort((a, b) => new Date(a.shift.start).getTime() - new Date(b.shift.start).getTime());

  const activeRequests = (swaps ?? []).filter(r => r.requesterId === user?.id && ['pending_target', 'open', 'pending_manager'].includes(r.status));

  async function callOut(assignmentId: string) {
    const ok = await confirm({ title: "Can't make this shift?", danger: true, confirmLabel: 'Confirm call-out', body: 'Your manager is notified immediately so they can find coverage.' });
    if (!ok) return;
    await api.post(`/assignments/${assignmentId}/call-out`);
    showToast('Call-out recorded — your manager has been notified.', 'warning');
    reloadShifts();
  }

  async function drop(assignmentId: string) {
    try {
      await api.post('/swap-requests', { type: 'drop', assignmentId });
      showToast("Shift offered up — visible to qualified teammates until 24h before it starts.", 'success');
      reloadSwaps();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not file that request.', 'warning');
    }
  }

  function openSwapPicker(assignmentId: string, shift: Shift) {
    const location = locationsById.get(shift.locationId);
    if (!location) return;
    openModal(<CoverageModalContent shiftId={shift.id} location={location} mode="swap" assignmentId={assignmentId} excludeStaffId={user?.id} onDone={reloadSwaps} />);
  }

  return (
    <>
      <section className="section-title">
        <div><p className="eyebrow">MY SCHEDULE</p><h2>Your upcoming shifts</h2></div>
        <span>{activeRequests.length}/{MAX_PENDING_REQUESTS} active swap requests</span>
      </section>
      <div className="table">
        <div className="thead"><span>SHIFT</span><span>LOCATION</span><span>TIME</span><span>ACTIONS</span></div>
        {myAssignments.length === 0 && <p className="empty">No upcoming shifts.</p>}
        {myAssignments.map(({ assignment, shift }) => {
          const location = locationsById.get(shift.locationId);
          if (!location) return null;
          const hasActiveRequest = (swaps ?? []).some(r => r.assignmentId === assignment.id && ['pending_target', 'open', 'pending_manager'].includes(r.status));
          return (
            <div className="row" key={assignment.id}>
              <div className="shift-name"><i className="shift-dot mint" /><div><strong>{shift.skill}</strong><small>{shift.status === 'draft' ? 'Draft — not yet published' : 'Published'}</small></div></div>
              <div>{location.name}<small>{location.code}</small></div>
              <div>{formatDateInZone(shift.start, location.timezone)}<small>{formatTimeInZone(shift.start, location.timezone)}–{formatTimeInZone(shift.end, location.timezone)}</small></div>
              <div className="row-status">
                {hasActiveRequest ? <label className="pending">◌ Request pending</label> : (
                  <>
                    <button className="link small" onClick={() => callOut(assignment.id)}>Can&rsquo;t make it</button>
                    <button className="link small" onClick={() => openSwapPicker(assignment.id, shift)}>Swap</button>
                    <button className="link small" onClick={() => drop(assignment.id)}>Drop</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

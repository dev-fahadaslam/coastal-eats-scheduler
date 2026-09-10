import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useApiData } from '../hooks/useApiData.js';
import { useRealtimeRefetch } from '../hooks/useRealtimeRefetch.js';
import { useModal } from '../context/ModalContext.js';
import { useToast } from '../context/ToastContext.js';
import { useConfirm } from '../hooks/useConfirm.js';
import { LocationTabs } from '../components/LocationTabs.js';
import { ShiftFormModalContent } from '../components/ShiftFormModalContent.js';
import { CoverageModalContent } from '../components/CoverageModalContent.js';
import { formatDateInZone, formatTimeInZone } from '../lib/time.js';
import { canEditShiftClient, PUBLISH_CUTOFF_HOURS } from '../lib/rules.js';
import type { Assignment, Location, Shift, User } from '../api/types.js';

interface ShiftsResponse { shifts: Shift[]; assignments: Assignment[] }

export default function SchedulePage() {
  const { user } = useAuth();
  const { openModal } = useModal();
  const showToast = useToast();
  const confirm = useConfirm();
  const canManage = user?.role !== 'staff';

  const { data: locations } = useApiData(() => api.get<Location[]>('/locations'), []);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);

  useEffect(() => {
    if (locations && locations.length > 0 && !activeLocation) setActiveLocation(locations[0]!.id);
  }, [locations, activeLocation]);

  const { data: shiftsData, reload } = useApiData(
    () => (activeLocation ? api.get<ShiftsResponse>(`/shifts?locationIds=${activeLocation}`) : Promise.resolve({ shifts: [], assignments: [] })),
    [activeLocation],
  );
  useRealtimeRefetch(reload);

  const { data: staff } = useApiData(
    () => (activeLocation ? api.get<User[]>(`/users?locationIds=${activeLocation}`) : Promise.resolve([])),
    [activeLocation],
  );
  const staffById = useMemo(() => new Map((staff ?? []).map(u => [u.id, u])), [staff]);

  if (!locations || locations.length === 0) return <p className="empty">No locations assigned.</p>;
  const location = locations.find(l => l.id === activeLocation) ?? locations[0]!;
  const shifts = [...(shiftsData?.shifts ?? [])].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const draftCount = shifts.filter(s => s.status === 'draft').length;

  function openHeadcount(shift: Shift): number {
    const filled = (shiftsData?.assignments ?? []).filter(a => a.shiftId === shift.id && a.status === 'assigned').length;
    return shift.headcount - filled;
  }

  function openCoverage(shift: Shift) {
    openModal(<CoverageModalContent shiftId={shift.id} location={location} mode="assign" onDone={reload} />);
  }

  function openShiftForm(shift?: Shift) {
    openModal(<ShiftFormModalContent location={location} shift={shift} onSaved={reload} />);
  }

  async function publish() {
    const ok = await confirm({
      title: 'Publish this schedule?',
      body: `${draftCount} draft shift(s) at ${location.name} will become visible to staff, who will be notified immediately.`,
      confirmLabel: 'Publish',
    });
    if (!ok) return;
    await api.post(`/shifts/publish/${location.id}`);
    showToast('Schedule published — staff notified in real time.', 'success');
    reload();
  }

  async function callOut(assignmentId: string, staffName: string) {
    const ok = await confirm({
      title: 'Record a call-out?',
      body: `${staffName} will be marked as called out and managers notified immediately.`,
      confirmLabel: 'Record call-out',
      danger: true,
    });
    if (!ok) return;
    await api.post(`/assignments/${assignmentId}/call-out`);
    showToast('Call-out recorded. Coverage suggestions are ready.', 'warning');
    reload();
  }

  return (
    <>
      <LocationTabs
        locations={locations}
        active={location.id}
        onSelect={setActiveLocation}
        trailing={canManage ? (
          <>
            <button className="ghost" style={{ marginLeft: 'auto' }} onClick={() => openShiftForm()}>+ New shift</button>
            <button className="primary" disabled={draftCount === 0} onClick={publish}>
              ↑ Publish {draftCount ? `(${draftCount} draft)` : ''}
            </button>
          </>
        ) : null}
      />
      <div className="table schedule-table">
        <div className="thead"><span>SHIFT</span><span>TIME ({location.code})</span><span>TEAM</span><span>STATUS</span></div>
        {shifts.length === 0 && <p className="empty">No shifts this week at this location.</p>}
        {shifts.map(shift => {
          const assignments = (shiftsData?.assignments ?? []).filter(a => a.shiftId === shift.id && a.status === 'assigned');
          const open = openHeadcount(shift);
          const editable = canEditShiftClient(shift.start);
          return (
            <div key={shift.id} className={`row ${open > 0 ? 'alert' : ''}`}>
              <div className="shift-name">
                <i className={`shift-dot ${shift.status === 'draft' ? 'purple' : open > 0 ? 'coral' : 'mint'}`} />
                <div>
                  <strong>{shift.skill}</strong>
                  <small>{formatDateInZone(shift.start, location.timezone)} · {shift.headcount - open}/{shift.headcount} filled</small>
                </div>
              </div>
              <div>{formatTimeInZone(shift.start, location.timezone)} – {formatTimeInZone(shift.end, location.timezone)}</div>
              <div className="faces">
                {assignments.length === 0 && <i>—</i>}
                {assignments.map(a => (
                  <span key={a.id}>
                    <i title={staffById.get(a.staffId)?.name}>{staffById.get(a.staffId)?.initials ?? '?'}</i>
                    {canManage && (
                      <button className="text-button small" onClick={() => callOut(a.id, staffById.get(a.staffId)?.name ?? 'this person')}>
                        call-out
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="row-status">
                {shift.status === 'draft'
                  ? <label className="pending">◌ Draft</label>
                  : open > 0
                    ? <button className="coverage" onClick={() => openCoverage(shift)}>Find coverage <span>→</span></button>
                    : <label className="good"><b>●</b> Fully staffed</label>}
                {canManage && (
                  <button className="link small" onClick={() => openShiftForm(shift)}>
                    {editable ? 'Edit' : `Locked (<${PUBLISH_CUTOFF_HOURS}h)`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

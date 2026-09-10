import { useMemo } from 'react';
import { api } from '../api/client.js';
import { useApiData } from '../hooks/useApiData.js';
import { useRealtimeRefetch } from '../hooks/useRealtimeRefetch.js';
import { useModal } from '../context/ModalContext.js';
import { CoverageModalContent } from '../components/CoverageModalContent.js';
import { formatDateInZone, formatTimeInZone, WEEKDAY_NAMES } from '../lib/time.js';
import type { Assignment, FairnessReport, LaborSummary, Location, OnDutyEntry, Shift, SwapRequest } from '../api/types.js';
import { useNavigate } from 'react-router-dom';

interface ShiftsResponse { shifts: Shift[]; assignments: Assignment[] }

export default function OverviewPage() {
  const { openModal } = useModal();
  const navigate = useNavigate();
  const { data: locations } = useApiData(() => api.get<Location[]>('/locations'), []);
  const locationsById = useMemo(() => new Map((locations ?? []).map(l => [l.id, l])), [locations]);

  const { data: shiftsData, reload: reloadShifts } = useApiData(() => api.get<ShiftsResponse>('/shifts'), []);
  const { data: onDuty, reload: reloadOnDuty } = useApiData(() => api.get<OnDutyEntry[]>('/dashboard/on-duty'), []);
  const { data: labor, reload: reloadLabor } = useApiData(() => api.get<LaborSummary>('/dashboard/labor'), []);
  const { data: fairness } = useApiData(() => api.get<FairnessReport>('/dashboard/fairness'), []);
  const { data: swaps } = useApiData(() => api.get<SwapRequest[]>('/swap-requests'), []);

  useRealtimeRefetch(() => { reloadShifts(); reloadOnDuty(); reloadLabor(); });

  const now = new Date();
  const shifts = shiftsData?.shifts ?? [];
  const assignments = shiftsData?.assignments ?? [];
  const filledCount = (shiftId: string) => assignments.filter(a => a.shiftId === shiftId && a.status === 'assigned').length;

  const openShifts = shifts
    .filter(s => s.status === 'published' && filledCount(s.id) < s.headcount && new Date(s.end) > now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const overStaff = (labor?.perStaff ?? []).filter(p => p.otHours > 0);
  const pendingSwaps = (swaps ?? []).filter(r => r.status === 'pending_manager');

  const perDayEntries = Object.entries(labor?.perDay ?? {}).sort(([a], [b]) => (a < b ? -1 : 1));
  const bars = WEEKDAY_NAMES.slice(1).concat(WEEKDAY_NAMES[0]!).map((name, i) => ({
    name, hours: perDayEntries[i]?.[1]?.hours ?? 0,
  }));
  const maxBar = Math.max(1, ...bars.map(b => b.hours));

  const priority = openShifts[0];
  const priorityLocation = priority ? locationsById.get(priority.locationId) : undefined;

  function findCoverage(shift: Shift) {
    const location = locationsById.get(shift.locationId);
    if (!location) return;
    openModal(<CoverageModalContent shiftId={shift.id} location={location} mode="assign" onDone={() => { reloadShifts(); reloadOnDuty(); }} />);
  }

  if (!locations) return null;

  return (
    <>
      {priority && priorityLocation && (
        <section className="command">
          <div className="command-content">
            <p className="eyebrow">PRIORITY ACTION · {priorityLocation.name.toUpperCase()}</p>
            <h2>{priority.skill} shift needs coverage.</h2>
            <p>
              {formatDateInZone(priority.start, priorityLocation.timezone)}, {formatTimeInZone(priority.start, priorityLocation.timezone)}–{formatTimeInZone(priority.end, priorityLocation.timezone)} {priorityLocation.code}.
              Every candidate is checked against rest, skills, availability, and overtime before you commit.
            </p>
            <div><button className="light" onClick={() => findCoverage(priority)}><span>Find qualified coverage</span> →</button></div>
          </div>
          <div className="command-orb"><div><b>{openShifts.length}</b><span>open<br />position{openShifts.length === 1 ? '' : 's'}</span></div></div>
        </section>
      )}

      <section className="metrics">
        <article>
          <div className="metric-top"><p>Shifts this week</p><span className="metric-icon green">▦</span></div>
          <strong>{shifts.length}</strong><small>Across {locations.length} location{locations.length === 1 ? '' : 's'}</small>
        </article>
        <article>
          <div className="metric-top"><p>Scheduled hours</p><span className="metric-icon blue">◷</span></div>
          <strong>{(labor?.totalHours ?? 0).toFixed(1)}h</strong><small>Across {labor?.perStaff.length ?? 0} team members</small>
        </article>
        <article>
          <div className="metric-top"><p>Projected labor</p><span className="metric-icon amber">$</span></div>
          <strong>${Math.round(labor?.totalCost ?? 0).toLocaleString('en-US')}</strong>
          <small className={overStaff.length ? 'warn' : ''}>{overStaff.length ? '↑ overtime exposure' : 'No overtime projected'}</small>
        </article>
        <article>
          <div className="metric-top"><p>Open coverage</p><span className="metric-icon red">!</span></div>
          <strong>{openShifts.length}</strong>
          <small className={openShifts.length ? 'danger' : ''}>{openShifts.length ? 'Needs attention today' : 'All shifts staffed'}</small>
        </article>
      </section>

      <section className="grid">
        <article className="panel schedule">
          <div className="panel-head"><div><h2>On duty now</h2><p><span className="live-dot" /> {onDuty?.length ?? 0} clocked in across your locations</p></div></div>
          <div className="table">
            <div className="thead"><span>PERSON</span><span>LOCATION</span><span>SHIFT</span><span>UNTIL</span></div>
            {(!onDuty || onDuty.length === 0) && <p className="empty">Nobody is on the clock right now.</p>}
            {onDuty?.map(entry => {
              const loc = entry.shift ? locationsById.get(entry.shift.locationId) : undefined;
              if (!entry.shift || !entry.staff || !loc) return null;
              return (
                <div className="row" key={entry.assignment.id}>
                  <div className="shift-name"><i className="shift-dot mint" /><div><strong>{entry.staff.name}</strong><small>{entry.shift.skill}</small></div></div>
                  <div>{loc.name}<small>{loc.code}</small></div>
                  <div>{entry.shift.skill}</div>
                  <div>{formatTimeInZone(entry.shift.end, loc.timezone)}</div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel attention">
          <div className="panel-head"><div><h2>Needs attention</h2><p>Prioritized by impact</p></div></div>
          {openShifts.slice(0, 3).map(s => {
            const loc = locationsById.get(s.locationId);
            if (!loc) return null;
            return (
              <div className="attention-item urgent" key={s.id}>
                <div className="icon coral">!</div>
                <div><strong>{s.skill} needs coverage</strong><p>{loc.name} · {formatDateInZone(s.start, loc.timezone)}</p></div>
                <button className="link" onClick={() => findCoverage(s)}>Resolve</button>
              </div>
            );
          })}
          {overStaff.slice(0, 2).map(p => (
            <div className="attention-item" key={p.staffId}>
              <div className="icon amber">$</div>
              <div><strong>Overtime projected</strong><p>{p.hours.toFixed(1)}h this week</p></div>
            </div>
          ))}
          {pendingSwaps.length > 0 && (
            <div className="attention-item">
              <div className="icon blue">↔</div>
              <div><strong>{pendingSwaps.length} swap request{pendingSwaps.length === 1 ? '' : 's'} awaiting approval</strong><p>Review in Coverage requests</p></div>
            </div>
          )}
          {openShifts.length === 0 && overStaff.length === 0 && pendingSwaps.length === 0 && <p className="empty">Nothing needs attention right now.</p>}
        </article>

        <article className="panel labor">
          <div className="panel-head"><div><h2>Labor outlook</h2><p>Scheduled hours by day</p></div></div>
          <div className="bars">
            {bars.map(b => (
              <div key={b.name}>
                <span>{b.name}</span>
                <i className={b.hours > maxBar * 0.85 ? 'hot' : ''} style={{ '--w': `${Math.round((b.hours / maxBar) * 100)}%` } as React.CSSProperties} />
                <b>{b.hours.toFixed(1)}h</b>
              </div>
            ))}
          </div>
          <div className="legend"><span><i /> Scheduled</span><span><i className="hot" /> Highest-load day</span></div>
        </article>

        <article className="panel fairness">
          <div className="panel-head"><div><h2>Fairness pulse</h2><p>Premium shifts · last 4 weeks</p></div><span className="score">{fairness?.score ?? 0} <small>/ 100</small></span></div>
          <div className="fairness-copy">
            <span className="badge">{(fairness?.score ?? 0) >= 75 ? 'On track' : 'Needs review'}</span>
            <strong>{(fairness?.rows ?? []).filter(r => r.gapToDesired < -4).length} team members under desired hours</strong>
            <p>Review the full breakdown before publishing next week.</p>
          </div>
          <div className="progress"><i style={{ width: `${fairness?.score ?? 0}%` }} /></div>
          <button className="wide" onClick={() => navigate('/fairness')}>Open fairness report <span>→</span></button>
        </article>
      </section>
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useApiData } from '../../hooks/useApiData.js';
import { useRealtimeRefetch } from '../../hooks/useRealtimeRefetch.js';
import { useToast } from '../../context/ToastContext.js';
import { formatDateInZone, formatTimeInZone } from '../../lib/time.js';
import type { Assignment, Candidate, Location, Shift, SwapRequest } from '../../api/types.js';

interface ShiftsResponse { shifts: Shift[]; assignments: Assignment[] }
interface CandidatesResponse { candidates: Candidate[] }
type MarketItem =
  | { kind: 'drop'; key: string; req: SwapRequest; shift: Shift }
  | { kind: 'open'; key: string; shift: Shift };

export default function OpenShiftsPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const { data: shiftsData, reload: reloadShifts } = useApiData(() => api.get<ShiftsResponse>('/shifts'), []);
  const { data: locations } = useApiData(() => api.get<Location[]>('/locations'), []);
  const { data: swaps, reload: reloadSwaps } = useApiData(() => api.get<SwapRequest[]>('/swap-requests'), []);
  useRealtimeRefetch(() => { reloadShifts(); reloadSwaps(); });

  const locationsById = useMemo(() => new Map((locations ?? []).map(l => [l.id, l])), [locations]);
  const shiftsById = useMemo(() => new Map((shiftsData?.shifts ?? []).map(s => [s.id, s])), [shiftsData]);
  const assignmentsById = useMemo(() => new Map((shiftsData?.assignments ?? []).map(a => [a.id, a])), [shiftsData]);
  const now = new Date();

  const candidateItems: MarketItem[] = useMemo(() => {
    type DropItem = Extract<MarketItem, { kind: 'drop' }>;
    const drops: MarketItem[] = (swaps ?? [])
      .filter(r => r.type === 'drop' && r.status === 'open')
      .map((r): DropItem | null => {
        const assignment = assignmentsById.get(r.assignmentId);
        const shift = assignment ? shiftsById.get(assignment.shiftId) : undefined;
        return shift ? { kind: 'drop', key: `drop:${r.id}`, req: r, shift } : null;
      })
      .filter((x): x is DropItem => x !== null);
    const open: MarketItem[] = (shiftsData?.shifts ?? [])
      .filter(s => s.status === 'published' && new Date(s.end) > now)
      .filter(s => {
        const filled = (shiftsData?.assignments ?? []).filter(a => a.shiftId === s.id && a.status === 'assigned').length;
        return filled < s.headcount;
      })
      .map(shift => ({ kind: 'open' as const, key: `open:${shift.id}`, shift }));
    return [...drops, ...open];
  }, [shiftsData, swaps, shiftsById, assignmentsById]);

  const [eligible, setEligible] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const results: Record<string, boolean> = {};
      for (const item of candidateItems) {
        try {
          const res = await api.get<CandidatesResponse>(`/shifts/${item.shift.id}/candidates`);
          const mine = res.candidates.find(c => c.person.id === user?.id);
          results[item.key] = mine?.evaluation.allowed ?? false;
        } catch {
          results[item.key] = false;
        }
      }
      if (!cancelled) setEligible(results);
    }
    void check();
    return () => { cancelled = true; };
  }, [candidateItems, user?.id]);

  const openItems = candidateItems
    .filter(item => eligible[item.key])
    .sort((a, b) => new Date(a.shift.start).getTime() - new Date(b.shift.start).getTime());

  async function pickUp(item: MarketItem) {
    try {
      if (item.kind === 'drop') {
        await api.post(`/swap-requests/${item.req.id}/claim`);
        showToast('Requested — your manager will confirm shortly.', 'success');
      } else {
        await api.post('/assignments', { shiftId: item.shift.id, staffId: user?.id, expectedVersion: item.shift.version });
        showToast("You're on the schedule for this shift.", 'success');
      }
      reloadShifts();
      reloadSwaps();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'This shift is no longer available — someone beat you to it.', 'warning');
    }
  }

  return (
    <>
      <section className="section-title"><div><p className="eyebrow">MARKETPLACE</p><h2>Open shifts you&rsquo;re qualified for</h2></div><span>{openItems.length} available</span></section>
      <div className="table">
        <div className="thead"><span>SHIFT</span><span>LOCATION</span><span>TIME</span><span>ACTION</span></div>
        {openItems.length === 0 && <p className="empty">Nothing open that matches your skills, certifications, and availability right now.</p>}
        {openItems.map(item => {
          const location = locationsById.get(item.shift.locationId);
          if (!location) return null;
          return (
            <div className="row" key={item.key}>
              <div className="shift-name">
                <i className={`shift-dot ${item.kind === 'drop' ? 'coral' : 'mint'}`} />
                <div><strong>{item.shift.skill}</strong><small>{item.kind === 'drop' ? 'Dropped by a teammate' : 'Open headcount'}</small></div>
              </div>
              <div>{location.name}<small>{location.code}</small></div>
              <div>{formatDateInZone(item.shift.start, location.timezone)}<small>{formatTimeInZone(item.shift.start, location.timezone)}–{formatTimeInZone(item.shift.end, location.timezone)}</small></div>
              <div><button className="primary small" onClick={() => pickUp(item)}>Pick up</button></div>
            </div>
          );
        })}
      </div>
    </>
  );
}

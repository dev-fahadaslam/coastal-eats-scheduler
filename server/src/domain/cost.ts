import { dateKeyInZone } from './time.js';

export const WAGE_RATES: Record<string, number> = { bartender: 22, 'line-cook': 19, server: 16, host: 15 };
const DEFAULT_RATE = 17;
const OT_MULTIPLIER = 1.5;
const hours = (start: string, end: string) => (new Date(end).getTime() - new Date(start).getTime()) / 36e5;

export interface CostShift {
  id: string;
  locationId: string;
  skill: string;
  start: string;
  end: string;
}
export interface CostAssignment {
  staffId: string;
  shiftId: string;
  status: string;
}
export interface CostLocation {
  timezone: string;
}
export interface PerStaffCost {
  staffId: string;
  hours: number;
  cost: number;
  otHours: number;
}
export interface DayBucket {
  hours: number;
  otHours: number;
}

export function laborSummary({
  assignments, shifts, locationIds, staffFilterIds, locationsById,
}: {
  assignments: CostAssignment[];
  shifts: CostShift[];
  locationIds?: string[];
  staffFilterIds?: string[];
  locationsById?: Map<string, CostLocation>;
}): { totalHours: number; totalCost: number; otHours: number; perStaff: PerStaffCost[]; perDay: Map<string, DayBucket> } {
  const shiftById = new Map(shifts.map(s => [s.id, s]));
  const byStaff = new Map<string, CostShift[]>();
  for (const a of assignments) {
    if (a.status !== 'assigned') continue;
    const shift = shiftById.get(a.shiftId);
    if (!shift || (locationIds && !locationIds.includes(shift.locationId))) continue;
    if (staffFilterIds && !staffFilterIds.includes(a.staffId)) continue;
    if (!byStaff.has(a.staffId)) byStaff.set(a.staffId, []);
    byStaff.get(a.staffId)!.push(shift);
  }

  let totalHours = 0, totalCost = 0, otHours = 0;
  const perStaff: PerStaffCost[] = [];
  const perDay = new Map<string, DayBucket>();

  for (const [staffId, staffShifts] of byStaff) {
    staffShifts.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    let runningHours = 0, staffCost = 0, staffOT = 0;
    for (const shift of staffShifts) {
      const h = hours(shift.start, shift.end);
      const rate = WAGE_RATES[shift.skill] ?? DEFAULT_RATE;
      const regular = Math.max(0, Math.min(h, 40 - runningHours));
      const overtime = h - regular;
      staffCost += regular * rate + overtime * rate * OT_MULTIPLIER;
      staffOT += overtime;
      runningHours += h;
      const dayKey = locationsById ? dateKeyInZone(shift.start, locationsById.get(shift.locationId)!.timezone) : shift.start.slice(0, 10);
      const bucket = perDay.get(dayKey) ?? { hours: 0, otHours: 0 };
      bucket.hours += h;
      if (overtime > 0) bucket.otHours += overtime;
      perDay.set(dayKey, bucket);
    }
    totalHours += runningHours; totalCost += staffCost; otHours += staffOT;
    perStaff.push({ staffId, hours: runningHours, cost: staffCost, otHours: staffOT });
  }

  return { totalHours, totalCost, otHours, perStaff: perStaff.sort((a, b) => b.otHours - a.otHours), perDay };
}

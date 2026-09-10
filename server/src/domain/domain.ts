import { localParts, dateKeyInZone, timeToMinutes } from './time.js';
import type {
  AvailabilityCheckResult, AvailabilityExceptionLike, AvailabilityRuleLike,
  AssignmentLike, CandidateLike, Evaluation, ShiftLike, SwapRequestLike,
} from './types.js';

export const RULES = {
  minRestHours: 10,
  dailyWarnHours: 8,
  dailyHardHours: 12,
  weeklyWarnHours: 35,
  weeklyOTHours: 40,
  consecutiveWarnDays: 6,
  consecutiveOverrideDays: 7,
  maxPendingRequests: 3,
  dropExpiryHours: 24,
  publishCutoffHours: 48,
} as const;

export const MIN_REST_HOURS = RULES.minRestHours;

const overlap = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start < b.end && b.start < a.end;
const hours = (start: string, end: string) => (new Date(end).getTime() - new Date(start).getTime()) / 36e5;

export function isWithinAvailability({
  start, end, timezone, rules = [], exceptions = [],
}: {
  start: string; end: string; timezone: string;
  rules?: AvailabilityRuleLike[]; exceptions?: AvailabilityExceptionLike[];
}): AvailabilityCheckResult {
  if (!rules.length && !exceptions.length) return { ok: true };
  const startLocal = localParts(start, timezone);
  const endLocalRaw = localParts(end, timezone);
  const endMinutes = endLocalRaw.minutesOfWeek <= startLocal.minutesOfWeek
    ? endLocalRaw.minutesOfWeek + 7 * 1440
    : endLocalRaw.minutesOfWeek;
  const dateKey = dateKeyInZone(start, timezone);

  const exception = exceptions.find(e => e.date === dateKey);
  if (exception) {
    if (exception.type === 'unavailable') {
      return { ok: false, reason: `Marked unavailable on ${dateKey} (one-off exception).` };
    }
    const winStart = startLocal.dow * 1440 + timeToMinutes(exception.startLocal);
    let winEnd = startLocal.dow * 1440 + timeToMinutes(exception.endLocal);
    if (winEnd <= winStart) winEnd += 1440;
    if (winStart <= startLocal.minutesOfWeek && winEnd >= endMinutes) return { ok: true };
    return { ok: false, reason: `Outside the one-off availability window set for ${dateKey}.` };
  }

  for (const rule of rules) {
    const winStart = rule.dayOfWeek * 1440 + timeToMinutes(rule.startLocal);
    let winEnd = rule.dayOfWeek * 1440 + timeToMinutes(rule.endLocal);
    if (winEnd <= winStart) winEnd += 1440;
    if (winStart <= startLocal.minutesOfWeek && winEnd >= endMinutes) return { ok: true };
  }
  return { ok: false, reason: 'No recurring availability window covers this shift’s local time at this location.' };
}

export function isCertifiedNow(
  staffId: string, locationId: string,
  certifications: { staffId: string; locationId: string; validFrom: string | Date; validTo: string | Date | null }[],
  at: Date = new Date(),
): boolean {
  return certifications.some(c => c.staffId === staffId && c.locationId === locationId
    && new Date(c.validFrom) <= at && (!c.validTo || new Date(c.validTo) > at));
}

export function consecutiveDaysEndingAt(_staffId: string, dateKey: string, workedDateKeys: Iterable<string>): number {
  const worked = new Set(workedDateKeys);
  let count = 0;
  const cursor = new Date(dateKey + 'T00:00:00Z');
  while (worked.has(cursor.toISOString().slice(0, 10))) {
    count += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return count;
}

export function evaluateAssignment({
  shift, candidate, assignments,
}: {
  shift: ShiftLike; candidate: CandidateLike; assignments: AssignmentLike[]; now?: Date;
}): Evaluation {
  const issues: string[] = [];
  const warnings: string[] = [];
  if (!candidate.skills.includes(shift.skill)) issues.push(`Missing required skill: ${shift.skill}.`);
  if (!candidate.locations.includes(shift.locationId)) issues.push('Not certified for this location.');

  const own = assignments.filter(a => a.staffId === candidate.id && a.status !== 'cancelled');
  if (own.some(a => overlap(shift, a))) issues.push('Double-booking: overlaps an existing assignment.');

  for (const assignment of own) {
    if (overlap(shift, assignment)) continue;
    const gap = Math.max(
      (new Date(shift.start).getTime() - new Date(assignment.end).getTime()) / 36e5,
      (new Date(assignment.start).getTime() - new Date(shift.end).getTime()) / 36e5
    );
    if (gap >= 0 && gap < RULES.minRestHours) {
      issues.push(`Minimum rest violation: only ${gap.toFixed(1)} of ${RULES.minRestHours} hours between shifts.`);
    }
  }

  if (shift.timezone) {
    const availability = isWithinAvailability({
      start: shift.start, end: shift.end, timezone: shift.timezone,
      rules: candidate.availability, exceptions: candidate.availabilityExceptions,
    });
    if (!availability.ok) issues.push(availability.reason!);
  }

  const dayHours = own
    .filter(a => new Date(a.start).toDateString() === new Date(shift.start).toDateString())
    .reduce((sum, a) => sum + hours(a.start, a.end), hours(shift.start, shift.end));
  if (dayHours > RULES.dailyHardHours) {
    issues.push(`Daily-hours hard block: projected ${dayHours.toFixed(1)} hours exceeds ${RULES.dailyHardHours}.`);
  } else if (dayHours > RULES.dailyWarnHours) {
    warnings.push(`Projected daily hours: ${dayHours.toFixed(1)} (over ${RULES.dailyWarnHours}-hour warning threshold).`);
  }

  const weekHours = own.reduce((sum, a) => sum + hours(a.start, a.end), hours(shift.start, shift.end));
  if (weekHours >= RULES.weeklyOTHours) {
    warnings.push(`Projected weekly hours: ${weekHours.toFixed(1)} — overtime cost applies.`);
  } else if (weekHours >= RULES.weeklyWarnHours) {
    warnings.push(`Projected weekly hours: ${weekHours.toFixed(1)} — approaching overtime.`);
  }

  if (shift.timezone) {
    const dateKey = dateKeyInZone(shift.start, shift.timezone);
    const workedDays = new Set(own.map(a => dateKeyInZone(a.start, shift.timezone!)));
    workedDays.add(dateKey);
    const consecutive = consecutiveDaysEndingAt(candidate.id, dateKey, workedDays);
    if (consecutive === RULES.consecutiveWarnDays) {
      warnings.push(`This would be the ${consecutive}th consecutive day worked.`);
    } else if (consecutive >= RULES.consecutiveOverrideDays) {
      issues.push(`${consecutive}th consecutive day worked — requires manager override with a documented reason.`);
    }
  }

  return { allowed: issues.length === 0, issues, warnings, projected: { dayHours, weekHours } };
}

export function eligibleCandidates(shift: ShiftLike, staff: CandidateLike[], assignments: AssignmentLike[]) {
  return staff
    .map(person => ({ person, evaluation: evaluateAssignment({ shift, candidate: person, assignments }) }))
    .sort((a, b) => {
      if (a.evaluation.allowed !== b.evaluation.allowed) return a.evaluation.allowed ? -1 : 1;
      return a.evaluation.projected.weekHours - b.evaluation.projected.weekHours;
    });
}

export function assertVersion(currentVersion: number, receivedVersion: number): void {
  if (currentVersion !== receivedVersion) {
    throw new Error('This shift changed in another session. Refresh before retrying.');
  }
}

const PREMIUM_WINDOWS: [number, number][] = [
  [5 * 1440 + 16 * 60, 5 * 1440 + 1440 + 2 * 60],
  [6 * 1440 + 16 * 60, 6 * 1440 + 1440 + 2 * 60],
];
export function isPremiumShift(shift: { start: string; end: string }, timezone: string): boolean {
  const start = localParts(shift.start, timezone);
  const endRaw = localParts(shift.end, timezone);
  const end = endRaw.minutesOfWeek <= start.minutesOfWeek ? endRaw.minutesOfWeek + 7 * 1440 : endRaw.minutesOfWeek;
  return PREMIUM_WINDOWS.some(([winStart, winEnd]) => start.minutesOfWeek < winEnd && winStart < end);
}

export function canEditShift(shift: { start: string }, now: Date = new Date()): boolean {
  return (new Date(shift.start).getTime() - now.getTime()) / 36e5 >= RULES.publishCutoffHours;
}

export function isDropExpired(shift: { start: string }, now: Date = new Date()): boolean {
  return (new Date(shift.start).getTime() - now.getTime()) / 36e5 <= RULES.dropExpiryHours;
}

const ACTIVE_REQUEST_STATUSES = ['pending_target', 'open', 'pending_manager'];
export function activeRequestCount(staffId: string, swapRequests: SwapRequestLike[]): number {
  return swapRequests.filter(r => r.requesterId === staffId && ACTIVE_REQUEST_STATUSES.includes(r.status)).length;
}
export function canFileNewRequest(staffId: string, swapRequests: SwapRequestLike[]): boolean {
  return activeRequestCount(staffId, swapRequests) < RULES.maxPendingRequests;
}

export interface FairnessStaffInput {
  id: string;
  name: string;
  desiredHours?: number;
}
export interface FairnessShiftInput {
  id: string;
  locationId: string;
  start: string;
  end: string;
}
export interface FairnessAssignmentInput {
  staffId: string;
  shiftId: string;
  status: string;
}
export interface FairnessLocation {
  timezone: string;
}
export interface FairnessRow {
  id: string;
  name: string;
  desiredHours: number;
  totalHours: number;
  premiumHours: number;
  premiumShiftCount: number;
  shiftCount: number;
  hoursShare: number;
  premiumDeviation: number;
  gapToDesired: number;
}

export function fairnessReport({
  staff, assignments, shifts, locationsById, sinceDate,
}: {
  staff: FairnessStaffInput[];
  assignments: FairnessAssignmentInput[];
  shifts: FairnessShiftInput[];
  locationsById: Map<string, FairnessLocation>;
  sinceDate?: string | Date;
}): { rows: FairnessRow[]; score: number; fairShare: number; totalPremium: number } {
  const since = sinceDate ? new Date(sinceDate) : new Date(0);
  const byStaff = new Map<string, FairnessRow>(staff.map(s => [s.id, {
    id: s.id, name: s.name, desiredHours: s.desiredHours ?? 0,
    totalHours: 0, premiumHours: 0, premiumShiftCount: 0, shiftCount: 0,
    hoursShare: 0, premiumDeviation: 0, gapToDesired: 0,
  }]));

  for (const a of assignments) {
    if (a.status === 'cancelled') continue;
    const shift = shifts.find(s => s.id === a.shiftId);
    if (!shift || new Date(shift.start) < since) continue;
    const bucket = byStaff.get(a.staffId);
    if (!bucket) continue;
    const location = locationsById.get(shift.locationId);
    const h = hours(shift.start, shift.end);
    bucket.totalHours += h;
    bucket.shiftCount += 1;
    if (location && isPremiumShift(shift, location.timezone)) {
      bucket.premiumHours += h;
      bucket.premiumShiftCount += 1;
    }
  }

  const rows = [...byStaff.values()];
  const totalPremium = rows.reduce((sum, r) => sum + r.premiumHours, 0);
  const totalHoursAll = rows.reduce((sum, r) => sum + r.totalHours, 0) || 1;
  const withStake = rows.filter(r => r.shiftCount > 0);
  const fairShare = totalPremium / (withStake.length || 1);

  for (const row of rows) {
    row.hoursShare = row.totalHours / totalHoursAll;
    row.premiumDeviation = row.shiftCount > 0 ? row.premiumHours - fairShare : 0;
    row.gapToDesired = row.totalHours - row.desiredHours;
  }

  const sumAbsDeviation = withStake.reduce((sum, r) => sum + Math.abs(r.premiumDeviation), 0);
  const score = totalPremium > 0 ? Math.max(0, Math.round(100 * (1 - sumAbsDeviation / (2 * totalPremium)))) : 100;

  return { rows: rows.sort((a, b) => b.totalHours - a.totalHours), score, fairShare, totalPremium };
}

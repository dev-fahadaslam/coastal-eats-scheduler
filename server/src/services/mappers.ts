import type { IUser } from '../models/User.js';
import type { ICertification } from '../models/Certification.js';
import type { IAvailabilityRule } from '../models/AvailabilityRule.js';
import type { IAvailabilityException } from '../models/AvailabilityException.js';
import type { IShift } from '../models/Shift.js';
import type { IAssignment } from '../models/Assignment.js';
import type { CandidateLike, AssignmentLike, ShiftLike } from '../domain/types.js';
import { isCertifiedNow } from '../domain/domain.js';

export function certifiedLocationIds(staffId: string, certifications: ICertification[], at: Date = new Date()): string[] {
  return [...new Set(
    certifications
      .filter(c => c.staffId === staffId && isCertifiedNow(staffId, c.locationId, certifications, at))
      .map(c => c.locationId)
  )];
}

export function toCandidate(
  user: IUser,
  certifications: ICertification[],
  rules: IAvailabilityRule[],
  exceptions: IAvailabilityException[],
  locationId?: string,
): CandidateLike {
  return {
    id: user.id as unknown as string,
    name: user.name,
    initials: user.initials,
    skills: user.skills ?? [],
    locations: certifiedLocationIds(user.id as unknown as string, certifications),
    availability: rules
      .filter(r => r.staffId === (user.id as unknown as string) && (!locationId || r.locationId === locationId))
      .map(r => ({ dayOfWeek: r.dayOfWeek, startLocal: r.startLocal, endLocal: r.endLocal, locationId: r.locationId })),
    availabilityExceptions: exceptions
      .filter(e => e.staffId === (user.id as unknown as string) && (!locationId || e.locationId === locationId))
      .map(e => ({ date: e.date, type: e.type, startLocal: e.startLocal, endLocal: e.endLocal, locationId: e.locationId })),
    desiredHours: user.desiredHours,
  };
}

export function toShiftLike(shift: IShift, timezone?: string): ShiftLike {
  return {
    locationId: shift.locationId,
    skill: shift.skill,
    start: shift.start.toISOString(),
    end: shift.end.toISOString(),
    timezone,
  };
}

export function toAssignmentLike(assignment: IAssignment, shift: IShift): AssignmentLike {
  return {
    staffId: assignment.staffId,
    start: shift.start.toISOString(),
    end: shift.end.toISOString(),
    status: assignment.status,
  };
}

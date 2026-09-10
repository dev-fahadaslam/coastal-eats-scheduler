export interface AvailabilityRuleLike {
  dayOfWeek: number;
  startLocal: string;
  endLocal: string;
  locationId?: string;
}

export interface AvailabilityExceptionLike {
  date: string;
  type: 'unavailable' | 'available';
  startLocal: string;
  endLocal: string;
  locationId?: string;
}

export interface AssignmentLike {
  staffId: string;
  start: string;
  end: string;
  status?: string;
}

export interface ShiftLike {
  locationId: string;
  skill: string;
  start: string;
  end: string;
  timezone?: string;
}

export interface CandidateLike {
  id: string;
  name?: string;
  initials?: string;
  skills: string[];
  locations: string[];
  availability?: AvailabilityRuleLike[];
  availabilityExceptions?: AvailabilityExceptionLike[];
  desiredHours?: number;
}

export interface Evaluation {
  allowed: boolean;
  issues: string[];
  warnings: string[];
  projected: { dayHours: number; weekHours: number };
}

export interface AvailabilityCheckResult {
  ok: boolean;
  reason?: string;
}

export interface SwapRequestLike {
  requesterId: string;
  status: string;
}

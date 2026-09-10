export type Role = 'admin' | 'manager' | 'staff';
export type NotificationChannel = 'in-app' | 'in-app+email';

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  title?: string;
  locationIds: string[];
  skills: string[];
  desiredHours?: number;
  notificationPrefs: { channel: NotificationChannel };
}

export interface Location {
  id: string;
  name: string;
  city: string;
  timezone: string;
  code: string;
}

export interface Certification {
  id: string;
  staffId: string;
  locationId: string;
  validFrom: string;
  validTo: string | null;
}

export interface AvailabilityRule {
  id: string;
  staffId: string;
  locationId: string;
  dayOfWeek: number;
  startLocal: string;
  endLocal: string;
}

export interface AvailabilityException {
  id: string;
  staffId: string;
  locationId: string;
  date: string;
  type: 'unavailable' | 'available';
}

export type ShiftStatus = 'draft' | 'published';

export interface Shift {
  id: string;
  locationId: string;
  skill: string;
  headcount: number;
  start: string;
  end: string;
  status: ShiftStatus;
  version: number;
  tag: string | null;
}

export type AssignmentStatus = 'assigned' | 'called_out' | 'cancelled';

export interface Assignment {
  id: string;
  shiftId: string;
  staffId: string;
  status: AssignmentStatus;
  assignedAt: string;
  assignedBy: string;
  overrideReason: string | null;
}

export type SwapType = 'swap' | 'drop';
export type SwapStatus = 'pending_target' | 'open' | 'pending_manager' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export interface SwapRequest {
  id: string;
  type: SwapType;
  requesterId: string;
  assignmentId: string;
  targetStaffId: string | null;
  status: SwapStatus;
  createdAt: string;
  respondedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  reason: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedId: string | null;
  createdAt: string;
  read: boolean;
  emailSimulated: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  locationId: string | null;
  summary: string;
}

export interface Evaluation {
  allowed: boolean;
  issues: string[];
  warnings: string[];
  projected: { dayHours: number; weekHours: number };
}

export interface Candidate {
  person: User;
  evaluation: Evaluation;
}

export interface FairnessRow {
  id: string;
  name: string;
  desiredHours: number;
  totalHours: number;
  premiumHours: number;
  premiumShiftCount: number;
  shiftCount: number;
  premiumDeviation: number;
  gapToDesired: number;
}

export interface FairnessReport {
  rows: FairnessRow[];
  score: number;
  fairShare: number;
  totalPremium: number;
}

export interface PerStaffCost {
  staffId: string;
  hours: number;
  cost: number;
  otHours: number;
}

export interface LaborSummary {
  totalHours: number;
  totalCost: number;
  otHours: number;
  perStaff: PerStaffCost[];
  perDay: Record<string, { hours: number; otHours: number }>;
}

export interface OnDutyEntry {
  assignment: Assignment;
  shift?: Shift;
  staff?: User;
}

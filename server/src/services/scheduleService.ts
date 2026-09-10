import Shift, { type IShift } from '../models/Shift.js';
import Assignment from '../models/Assignment.js';
import User, { type IUser } from '../models/User.js';
import Certification from '../models/Certification.js';
import AvailabilityRule from '../models/AvailabilityRule.js';
import AvailabilityException from '../models/AvailabilityException.js';
import Location from '../models/Location.js';
import SwapRequest from '../models/SwapRequest.js';
import { evaluateAssignment, canEditShift, RULES } from '../domain/domain.js';
import type { Evaluation } from '../domain/types.js';
import { toCandidate, toShiftLike, certifiedLocationIds } from './mappers.js';
import { recordAudit } from './auditService.js';
import { notify } from './notificationService.js';
import { emitToLocation } from '../sockets/bus.js';
import { ConstraintError, ConflictError, NotFoundError } from './errors.js';

export async function visibleLocationIds(user: IUser): Promise<string[]> {
  if (user.role === 'admin') {
    const locations = await Location.find();
    return locations.map(l => l.id);
  }
  if (user.role === 'manager') return user.locationIds;
  const certs = await Certification.find({ staffId: user.id });
  return certifiedLocationIds(user.id, certs);
}

async function otherAssignmentsFor(staffId: string, excludeAssignmentId?: string) {
  const query: Record<string, unknown> = { staffId, status: 'assigned' };
  if (excludeAssignmentId) query._id = { $ne: excludeAssignmentId };
  const assignments = await Assignment.find(query);
  const shifts = await Shift.find({ _id: { $in: assignments.map(a => a.shiftId) } });
  const shiftsById = new Map(shifts.map(s => [s.id, s]));
  return assignments
    .map(a => {
      const shift = shiftsById.get(a.shiftId);
      return shift ? { staffId: a.staffId, start: shift.start.toISOString(), end: shift.end.toISOString() } : null;
    })
    .filter((x): x is { staffId: string; start: string; end: string } => x !== null);
}

export async function evaluateForShift(shift: IShift, staffId: string, excludeAssignmentId?: string): Promise<Evaluation> {
  const location = await Location.findById(shift.locationId);
  if (!location) throw new NotFoundError('Location not found.');
  const [user, certs, rules, exceptions] = await Promise.all([
    User.findById(staffId),
    Certification.find({ staffId }),
    AvailabilityRule.find({ staffId }),
    AvailabilityException.find({ staffId }),
  ]);
  if (!user) throw new NotFoundError('Staff member not found.');
  const candidate = toCandidate(user, certs, rules, exceptions, shift.locationId);
  const assignments = await otherAssignmentsFor(staffId, excludeAssignmentId);
  return evaluateAssignment({ shift: toShiftLike(shift, location.timezone), candidate, assignments });
}

export async function candidatesForShift(shift: IShift) {
  const staff = await User.find({ role: 'staff' });
  const results = await Promise.all(staff.map(async person => ({
    person: person.toJSON(),
    evaluation: await evaluateForShift(shift, person.id),
  })));
  return results.sort((a, b) => {
    if (a.evaluation.allowed !== b.evaluation.allowed) return a.evaluation.allowed ? -1 : 1;
    return a.evaluation.projected.weekHours - b.evaluation.projected.weekHours;
  });
}

export async function openHeadcount(shiftId: string): Promise<number> {
  const shift = await Shift.findById(shiftId);
  if (!shift) throw new NotFoundError('Shift not found.');
  const filled = await Assignment.countDocuments({ shiftId, status: 'assigned' });
  return shift.headcount - filled;
}

export async function createShift(
  input: { locationId: string; skill: string; headcount: number; start: string; end: string },
  actor: IUser,
): Promise<IShift> {
  const shift = await Shift.create({ ...input, status: 'draft', version: 1, tag: null });
  await recordAudit(actor, {
    action: 'create_shift', entity: 'shift', entityId: shift.id,
    locationId: shift.locationId, after: shift.toJSON(), summary: `Created a ${shift.skill} shift.`,
  });
  return shift;
}

export async function updateShift(input: {
  shiftId: string;
  changes: Partial<Pick<IShift, 'skill' | 'headcount' | 'start' | 'end'>>;
  actor: IUser;
  override?: boolean;
}): Promise<IShift> {
  const { shiftId, changes, actor, override } = input;
  const shift = await Shift.findById(shiftId);
  if (!shift) throw new NotFoundError('That shift no longer exists.');
  if (!override && !canEditShift({ start: shift.start.toISOString() })) {
    throw new ConstraintError(`Locked: inside the ${RULES.publishCutoffHours}-hour publish cutoff. An admin can override.`);
  }
  const before = shift.toJSON();
  const updated = await Shift.findOneAndUpdate(
    { _id: shiftId, version: shift.version },
    { $set: changes, $inc: { version: 1 } },
    { new: true },
  );
  if (!updated) throw new ConflictError('This shift changed in another session — refresh before retrying.');

  await recordAudit(actor, {
    action: 'edit_shift', entity: 'shift', entityId: shiftId, locationId: shift.locationId,
    before, after: updated.toJSON(), summary: `Edited a ${updated.skill} shift.`,
  });

  const assignments = await Assignment.find({ shiftId });
  const affected = await SwapRequest.find({
    assignmentId: { $in: assignments.map(a => a.id) },
    status: { $in: ['pending_target', 'open', 'pending_manager'] },
  });
  for (const req of affected) {
    req.status = 'cancelled';
    await req.save();
    await notify(req.requesterId, {
      type: 'swap_cancelled', title: 'Swap request cancelled',
      message: 'The manager edited this shift, so the pending request was automatically cancelled.',
      relatedId: req.id,
    });
    if (req.targetStaffId) {
      await notify(req.targetStaffId, {
        type: 'swap_cancelled', title: 'Swap request cancelled',
        message: 'A shift you were about to take was edited, so the request was automatically cancelled.',
        relatedId: req.id,
      });
    }
  }

  emitToLocation(updated.locationId, 'shift-update', { shiftId });
  return updated;
}

export async function publishWeek(locationId: string, actor: IUser): Promise<void> {
  const drafts = await Shift.find({ locationId, status: 'draft' });
  await Shift.updateMany({ locationId, status: 'draft' }, { $set: { status: 'published' }, $inc: { version: 1 } });

  await recordAudit(actor, {
    action: 'publish', entity: 'schedule', entityId: locationId, locationId,
    before: { status: 'draft' }, after: { status: 'published' },
    summary: `Published the schedule (${drafts.length} shift${drafts.length === 1 ? '' : 's'}).`,
  });

  const shiftIds = drafts.map(s => s.id);
  const assignments = await Assignment.find({ shiftId: { $in: shiftIds }, status: 'assigned' });
  const staffIds = [...new Set(assignments.map(a => a.staffId))];
  for (const staffId of staffIds) {
    await notify(staffId, {
      type: 'schedule_published', title: 'Schedule published',
      message: 'A new schedule affecting your shifts was published.', relatedId: locationId,
    });
  }
  emitToLocation(locationId, 'shift-update', { locationId });
}

export async function assignStaff(input: {
  shiftId: string; staffId: string; expectedVersion?: number; actor: IUser; override?: { reason: string };
}) {
  const { shiftId, staffId, expectedVersion, actor, override } = input;
  const shift = await Shift.findById(shiftId);
  if (!shift) throw new NotFoundError('That shift no longer exists.');
  if (expectedVersion !== undefined && shift.version !== expectedVersion) {
    throw new ConflictError('This shift changed in another session — refresh before retrying.');
  }
  const filled = await Assignment.countDocuments({ shiftId, status: 'assigned' });
  if (filled >= shift.headcount) throw new ConstraintError('This shift is already fully staffed.');

  const evaluation = await evaluateForShift(shift, staffId);
  if (!evaluation.allowed && !override) throw new ConstraintError(evaluation.issues[0]!, evaluation);

  const updated = await Shift.findOneAndUpdate({ _id: shiftId, version: shift.version }, { $inc: { version: 1 } }, { new: true });
  if (!updated) throw new ConflictError('This shift changed in another session — refresh before retrying.');

  const assignment = await Assignment.create({
    shiftId, staffId, status: 'assigned', assignedAt: new Date(), assignedBy: actor.id, overrideReason: override?.reason ?? null,
  });

  const staff = await User.findById(staffId);
  await recordAudit(actor, {
    action: 'assign', entity: 'assignment', entityId: assignment.id, locationId: shift.locationId,
    before: null, after: { shiftId, staffId },
    summary: `Assigned ${staff?.name ?? staffId} to ${shift.skill} on ${shift.start.toISOString().slice(0, 10)}.`,
  });
  await notify(staffId, { type: 'shift_assigned', title: 'New shift assigned', message: `You were assigned a ${shift.skill} shift.`, relatedId: shiftId });
  emitToLocation(shift.locationId, 'shift-update', { shiftId });
  return assignment;
}

export async function callOut(assignmentId: string, actor: IUser): Promise<void> {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) throw new NotFoundError('That assignment no longer exists.');
  const shift = await Shift.findById(assignment.shiftId);
  if (!shift) throw new NotFoundError('That shift no longer exists.');

  assignment.status = 'called_out';
  await assignment.save();
  await Shift.updateOne({ _id: shift.id }, { $inc: { version: 1 } });

  const staff = await User.findById(assignment.staffId);
  await recordAudit(actor, {
    action: 'call_out', entity: 'assignment', entityId: assignmentId, locationId: shift.locationId,
    before: { status: 'assigned' }, after: { status: 'called_out' },
    summary: `${staff?.name ?? assignment.staffId} called out of a ${shift.skill} shift.`,
  });

  const managers = await User.find({ $or: [{ role: 'admin' }, { role: 'manager', locationIds: shift.locationId }] });
  for (const manager of managers) {
    await notify(manager.id, {
      type: 'call_out', title: 'Staff called out — coverage needed',
      message: `${staff?.name ?? 'A staff member'} called out of an upcoming ${shift.skill} shift.`,
      relatedId: shift.id,
    });
  }
  emitToLocation(shift.locationId, 'shift-update', { shiftId: shift.id });
}

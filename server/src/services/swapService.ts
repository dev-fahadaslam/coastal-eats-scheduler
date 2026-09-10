import Assignment from '../models/Assignment.js';
import Shift from '../models/Shift.js';
import SwapRequest, { type ISwapRequest } from '../models/SwapRequest.js';
import User, { type IUser } from '../models/User.js';
import { canFileNewRequest, isDropExpired, RULES } from '../domain/domain.js';
import { evaluateForShift } from './scheduleService.js';
import { recordAudit } from './auditService.js';
import { notify } from './notificationService.js';
import { emitToLocation } from '../sockets/bus.js';
import { ConstraintError, ConflictError, NotFoundError } from './errors.js';

const ACTIVE_STATUSES = ['pending_target', 'open', 'pending_manager'];

async function assertCanFile(staffId: string): Promise<void> {
  const active = await SwapRequest.countDocuments({ requesterId: staffId, status: { $in: ACTIVE_STATUSES } });
  if (active >= RULES.maxPendingRequests) {
    throw new ConstraintError(`You already have ${RULES.maxPendingRequests} pending swap/drop requests — resolve one before filing another.`);
  }
}

async function managersFor(locationId: string): Promise<IUser[]> {
  return User.find({ $or: [{ role: 'admin' }, { role: 'manager', locationIds: locationId }] });
}

export async function requestSwap(input: { assignmentId: string; targetStaffId: string; actor: IUser }): Promise<ISwapRequest> {
  const { assignmentId, targetStaffId, actor } = input;
  await assertCanFile(actor.id);
  const assignment = await Assignment.findOne({ _id: assignmentId, staffId: actor.id, status: 'assigned' });
  if (!assignment) throw new ConstraintError('You can only swap a shift currently assigned to you.');
  const shift = await Shift.findById(assignment.shiftId);
  if (!shift) throw new NotFoundError('That shift no longer exists.');
  const target = await User.findById(targetStaffId);
  if (!target) throw new NotFoundError('That teammate no longer exists.');
  const evaluation = await evaluateForShift(shift, targetStaffId);
  if (!evaluation.allowed) throw new ConstraintError(`${target.name} isn't eligible: ${evaluation.issues[0]}`);

  const req = await SwapRequest.create({
    type: 'swap', requesterId: actor.id, assignmentId, targetStaffId, status: 'pending_target', createdAt: new Date(),
  });
  await notify(targetStaffId, { type: 'swap_request', title: 'Swap request', message: `${actor.name} wants to swap a shift with you.`, relatedId: req.id });
  return req;
}

export async function requestDrop(input: { assignmentId: string; actor: IUser }): Promise<ISwapRequest> {
  const { assignmentId, actor } = input;
  await assertCanFile(actor.id);
  const assignment = await Assignment.findOne({ _id: assignmentId, staffId: actor.id, status: 'assigned' });
  if (!assignment) throw new ConstraintError('You can only drop a shift currently assigned to you.');
  return SwapRequest.create({
    type: 'drop', requesterId: actor.id, assignmentId, targetStaffId: null, status: 'open', createdAt: new Date(),
  });
}

export async function acceptSwap(swapId: string, actor: IUser): Promise<void> {
  const req = await SwapRequest.findById(swapId);
  if (!req || req.status !== 'pending_target' || req.targetStaffId !== actor.id) {
    throw new ConstraintError('This request is no longer waiting on your response.');
  }
  req.status = 'pending_manager';
  req.respondedAt = new Date();
  await req.save();

  const assignment = await Assignment.findById(req.assignmentId);
  const shift = assignment ? await Shift.findById(assignment.shiftId) : null;
  const requester = await User.findById(req.requesterId);
  if (shift) {
    for (const manager of await managersFor(shift.locationId)) {
      await notify(manager.id, {
        type: 'swap_pending', title: 'Swap awaiting your approval',
        message: `${actor.name} accepted a swap from ${requester?.name ?? 'a teammate'}.`, relatedId: req.id,
      });
    }
  }
}

export async function declineSwap(swapId: string, actor: IUser): Promise<void> {
  const req = await SwapRequest.findById(swapId);
  if (!req || req.status !== 'pending_target' || req.targetStaffId !== actor.id) {
    throw new ConstraintError('This request is no longer waiting on your response.');
  }
  req.status = 'cancelled';
  await req.save();
  await notify(req.requesterId, { type: 'swap_cancelled', title: 'Swap declined', message: `${actor.name} declined the swap request.`, relatedId: req.id });
}

export async function claimDrop(swapId: string, actor: IUser): Promise<void> {
  await assertCanFile(actor.id);
  const req = await SwapRequest.findById(swapId);
  if (!req || req.status !== 'open') throw new ConstraintError('This shift is no longer available to pick up.');
  const assignment = await Assignment.findById(req.assignmentId);
  const shift = assignment ? await Shift.findById(assignment.shiftId) : null;
  if (!shift) throw new NotFoundError('That shift no longer exists.');
  const evaluation = await evaluateForShift(shift, actor.id);
  if (!evaluation.allowed) throw new ConstraintError(evaluation.issues[0]!, evaluation);

  req.targetStaffId = actor.id;
  req.status = 'pending_manager';
  req.respondedAt = new Date();
  await req.save();

  for (const manager of await managersFor(shift.locationId)) {
    await notify(manager.id, {
      type: 'swap_pending', title: 'Pickup awaiting your approval',
      message: `${actor.name} wants to pick up a dropped shift.`, relatedId: req.id,
    });
  }
}

export async function cancelRequest(swapId: string, actor: IUser): Promise<void> {
  const req = await SwapRequest.findById(swapId);
  if (!req || req.requesterId !== actor.id) throw new ConstraintError('Only the requester can cancel this.');
  if (!ACTIVE_STATUSES.includes(req.status)) throw new ConstraintError('This request has already been resolved.');

  req.status = 'cancelled';
  await req.save();
  if (req.targetStaffId) {
    await notify(req.targetStaffId, {
      type: 'swap_cancelled', title: 'Swap cancelled',
      message: `${actor.name} changed their mind — the swap request was cancelled.`, relatedId: req.id,
    });
  }
  await recordAudit(actor, {
    action: 'cancel_request', entity: 'swap_request', entityId: req.id,
    before: { status: 'pending' }, after: { status: 'cancelled' },
    summary: `${actor.name} cancelled their own ${req.type} request before manager approval.`,
  });
}

export async function decideSwap(input: { swapId: string; approve: boolean; actor: IUser; reason?: string }): Promise<void> {
  const { swapId, approve, actor, reason } = input;
  const req = await SwapRequest.findById(swapId);
  if (!req || req.status !== 'pending_manager') throw new ConstraintError('This request is not awaiting manager approval.');
  const assignment = await Assignment.findById(req.assignmentId);
  if (!assignment) throw new NotFoundError('That assignment no longer exists.');
  const shift = await Shift.findById(assignment.shiftId);
  if (!shift) throw new NotFoundError('That shift no longer exists.');

  if (approve) {
    const target = await User.findById(req.targetStaffId!);
    if (!target) throw new NotFoundError('That teammate no longer exists.');
    const evaluation = await evaluateForShift(shift, target.id, assignment.id);
    if (!evaluation.allowed) throw new ConstraintError(`Can no longer approve: ${evaluation.issues[0]}`);

    assignment.status = 'cancelled';
    await assignment.save();
    const newAssignment = await Assignment.create({
      shiftId: shift.id, staffId: req.targetStaffId, status: 'assigned', assignedAt: new Date(), assignedBy: actor.id, overrideReason: null,
    });
    await Shift.updateOne({ _id: shift.id }, { $inc: { version: 1 } });

    req.status = 'approved';
    req.decidedAt = new Date();
    req.decidedBy = actor.id;
    await req.save();

    await recordAudit(actor, {
      action: 'approve_swap', entity: 'swap_request', entityId: req.id, locationId: shift.locationId,
      before: { staffId: assignment.staffId }, after: { staffId: req.targetStaffId },
      summary: `Approved a ${req.type} moving a ${shift.skill} shift to ${target.name}.`,
    });
    for (const uid of [req.requesterId, req.targetStaffId!]) {
      await notify(uid, { type: 'swap_approved', title: 'Swap approved', message: 'Your shift swap was approved by a manager.', relatedId: req.id });
    }
    emitToLocation(shift.locationId, 'shift-update', { shiftId: shift.id });
    void newAssignment;
  } else {
    req.status = req.type === 'drop' ? 'open' : 'rejected';
    req.reason = reason ?? null;
    if (req.type === 'drop') req.targetStaffId = null;
    req.decidedAt = new Date();
    req.decidedBy = actor.id;
    await req.save();

    await recordAudit(actor, {
      action: 'reject_swap', entity: 'swap_request', entityId: req.id, locationId: shift.locationId,
      before: { status: 'pending_manager' }, after: { status: req.status }, summary: `Rejected a ${req.type} request.`,
    });
    await notify(req.requesterId, { type: 'swap_rejected', title: 'Swap rejected', message: reason ?? 'A manager rejected this request.', relatedId: req.id });
  }
}

export async function expireStaleDrops(now: Date = new Date()): Promise<void> {
  const openDrops = await SwapRequest.find({ type: 'drop', status: 'open' });
  for (const req of openDrops) {
    const assignment = await Assignment.findById(req.assignmentId);
    const shift = assignment ? await Shift.findById(assignment.shiftId) : null;
    if (shift && isDropExpired({ start: shift.start.toISOString() }, now)) {
      req.status = 'expired';
      await req.save();
      await notify(req.requesterId, {
        type: 'drop_expired', title: 'Drop request expired',
        message: "Nobody claimed your dropped shift in time — you're still assigned to it.",
        relatedId: req.id,
      });
    }
  }
}

import { Router } from 'express';
import SwapRequest from '../models/SwapRequest.js';
import Assignment from '../models/Assignment.js';
import Shift from '../models/Shift.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { ah } from '../middleware/asyncHandler.js';
import { resolveLocationScope } from './util.js';
import {
  requestSwap, requestDrop, acceptSwap, declineSwap, claimDrop, cancelRequest, decideSwap, expireStaleDrops,
} from '../services/swapService.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const user = (req as AuthedRequest).user!;
  await expireStaleDrops();
  const scope = await resolveLocationScope(user);
  const all = await SwapRequest.find().sort({ createdAt: -1 });
  const assignments = await Assignment.find({ _id: { $in: all.map(r => r.assignmentId) } });
  const shifts = await Shift.find({ _id: { $in: assignments.map(a => a.shiftId) } });
  const shiftByAssignment = new Map(assignments.map(a => [a.id, shifts.find(s => s.id === a.shiftId)]));

  const scoped = all.filter(r => {
    const shift = shiftByAssignment.get(r.assignmentId);
    return shift && scope.includes(shift.locationId);
  });
  res.json(scoped.map(r => r.toJSON()));
}));

router.post('/', ah(async (req, res) => {
  const { type, assignmentId, targetStaffId } = req.body as { type: 'swap' | 'drop'; assignmentId: string; targetStaffId?: string };
  const actor = (req as AuthedRequest).user!;
  const req_ = type === 'swap'
    ? await requestSwap({ assignmentId, targetStaffId: targetStaffId!, actor })
    : await requestDrop({ assignmentId, actor });
  res.status(201).json(req_.toJSON());
}));

router.post('/:id/accept', ah(async (req, res) => {
  await acceptSwap(req.params.id!, (req as AuthedRequest).user!);
  res.status(204).end();
}));

router.post('/:id/decline', ah(async (req, res) => {
  await declineSwap(req.params.id!, (req as AuthedRequest).user!);
  res.status(204).end();
}));

router.post('/:id/claim', ah(async (req, res) => {
  await claimDrop(req.params.id!, (req as AuthedRequest).user!);
  res.status(204).end();
}));

router.post('/:id/cancel', ah(async (req, res) => {
  await cancelRequest(req.params.id!, (req as AuthedRequest).user!);
  res.status(204).end();
}));

router.post('/:id/decide', ah(async (req, res) => {
  const { approve, reason } = req.body as { approve: boolean; reason?: string };
  await decideSwap({ swapId: req.params.id!, approve, actor: (req as AuthedRequest).user!, reason });
  res.status(204).end();
}));

export default router;

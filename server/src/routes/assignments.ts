import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { ah } from '../middleware/asyncHandler.js';
import { assignStaff, callOut } from '../services/scheduleService.js';

const router = Router();
router.use(requireAuth);

router.post('/', ah(async (req, res) => {
  const { shiftId, staffId, expectedVersion } = req.body as { shiftId: string; staffId: string; expectedVersion?: number };
  const user = (req as AuthedRequest).user!;
  const assignment = await assignStaff({ shiftId, staffId: user.role === 'staff' ? user.id : staffId, expectedVersion, actor: user });
  res.status(201).json(assignment.toJSON());
}));

router.post('/:id/call-out', ah(async (req, res) => {
  await callOut(req.params.id!, (req as AuthedRequest).user!);
  res.status(204).end();
}));

export default router;

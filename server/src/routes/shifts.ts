import { Router } from 'express';
import Shift from '../models/Shift.js';
import Assignment from '../models/Assignment.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';
import { ah } from '../middleware/asyncHandler.js';
import { resolveLocationScope } from './util.js';
import {
  createShift, updateShift, publishWeek, candidatesForShift, openHeadcount,
} from '../services/scheduleService.js';
import { NotFoundError } from '../services/errors.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const user = (req as AuthedRequest).user!;
  const scope = await resolveLocationScope(user, req.query.locationIds as string | undefined);
  const shifts = await Shift.find({ locationId: { $in: scope } }).sort({ start: 1 });
  const shiftIds = shifts.map(s => s.id);
  const assignments = await Assignment.find({ shiftId: { $in: shiftIds } });
  res.json({
    shifts: shifts.map(s => s.toJSON()),
    assignments: assignments.map(a => a.toJSON()),
  });
}));

router.post('/', requireRole('manager', 'admin'), ah(async (req, res) => {
  const { locationId, skill, headcount, start, end } = req.body as {
    locationId: string; skill: string; headcount: number; start: string; end: string;
  };
  const shift = await createShift({ locationId, skill, headcount, start, end }, (req as AuthedRequest).user!);
  res.status(201).json(shift.toJSON());
}));

router.patch('/:id', requireRole('manager', 'admin'), ah(async (req, res) => {
  const { changes, override } = req.body as { changes: Record<string, unknown>; override?: boolean };
  const user = (req as AuthedRequest).user!;
  const shift = await updateShift({
    shiftId: req.params.id!,
    changes,
    actor: user,
    override: Boolean(override) && user.role === 'admin',
  });
  res.json(shift.toJSON());
}));

router.post('/publish/:locationId', requireRole('manager', 'admin'), ah(async (req, res) => {
  await publishWeek(req.params.locationId!, (req as AuthedRequest).user!);
  res.status(204).end();
}));

router.get('/:id/candidates', ah(async (req, res) => {
  const shift = await Shift.findById(req.params.id);
  if (!shift) throw new NotFoundError('Shift not found.');
  const results = await candidatesForShift(shift);
  const open = await openHeadcount(shift.id);
  res.json({ shift: shift.toJSON(), open, candidates: results });
}));

export default router;

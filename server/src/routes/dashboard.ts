import { Router } from 'express';
import Shift from '../models/Shift.js';
import Assignment from '../models/Assignment.js';
import User from '../models/User.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { ah } from '../middleware/asyncHandler.js';
import { resolveLocationScope } from './util.js';
import { buildFairnessReport } from '../services/fairnessService.js';
import { buildLaborSummary } from '../services/laborService.js';

const router = Router();
router.use(requireAuth);

router.get('/fairness', ah(async (req, res) => {
  const scope = await resolveLocationScope((req as AuthedRequest).user!, req.query.locationIds as string | undefined);
  const report = await buildFairnessReport(scope, req.query.since as string | undefined);
  res.json(report);
}));

router.get('/labor', ah(async (req, res) => {
  const scope = await resolveLocationScope((req as AuthedRequest).user!, req.query.locationIds as string | undefined);
  const summary = await buildLaborSummary(scope);
  res.json({ ...summary, perDay: Object.fromEntries(summary.perDay) });
}));

router.get('/on-duty', ah(async (req, res) => {
  const scope = await resolveLocationScope((req as AuthedRequest).user!, req.query.locationIds as string | undefined);
  const now = new Date();
  const shifts = await Shift.find({ locationId: { $in: scope }, start: { $lte: now }, end: { $gte: now } });
  const shiftIds = shifts.map(s => s.id);
  const assignments = await Assignment.find({ shiftId: { $in: shiftIds }, status: 'assigned' });
  const staff = await User.find({ _id: { $in: assignments.map(a => a.staffId) } });
  const staffById = new Map(staff.map(s => [s.id, s]));
  const shiftById = new Map(shifts.map(s => [s.id, s]));

  const onDuty = assignments.map(a => ({
    assignment: a.toJSON(),
    shift: shiftById.get(a.shiftId)?.toJSON(),
    staff: staffById.get(a.staffId)?.toJSON(),
  }));
  res.json(onDuty);
}));

export default router;

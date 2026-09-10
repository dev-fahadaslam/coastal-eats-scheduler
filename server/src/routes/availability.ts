import { Router } from 'express';
import AvailabilityRule from '../models/AvailabilityRule.js';
import AvailabilityException from '../models/AvailabilityException.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { ah } from '../middleware/asyncHandler.js';
import { setAvailability } from '../services/availabilityService.js';

const router = Router();
router.use(requireAuth);

router.get('/me', ah(async (req, res) => {
  const user = (req as AuthedRequest).user!;
  const [rules, exceptions] = await Promise.all([
    AvailabilityRule.find({ staffId: user.id }),
    AvailabilityException.find({ staffId: user.id }),
  ]);
  res.json({ rules: rules.map(r => r.toJSON()), exceptions: exceptions.map(e => e.toJSON()) });
}));

router.put('/me', ah(async (req, res) => {
  const user = (req as AuthedRequest).user!;
  const { rules, exceptions } = req.body as {
    rules: { locationId: string; dayOfWeek: number; startLocal: string; endLocal: string }[];
    exceptions: { locationId: string; date: string; type: 'unavailable' | 'available' }[];
  };
  await setAvailability({ staffId: user.id, rules, exceptions });
  res.status(204).end();
}));

export default router;

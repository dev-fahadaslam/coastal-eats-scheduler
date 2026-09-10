import { Router } from 'express';
import Location from '../models/Location.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { ah } from '../middleware/asyncHandler.js';
import { resolveLocationScope } from './util.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const scope = await resolveLocationScope((req as AuthedRequest).user!);
  const locations = await Location.find({ _id: { $in: scope } }).sort({ name: 1 });
  res.json(locations.map(l => l.toJSON()));
}));

export default router;

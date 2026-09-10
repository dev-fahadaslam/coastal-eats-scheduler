import { Router } from 'express';
import User from '../models/User.js';
import Certification from '../models/Certification.js';
import AvailabilityRule from '../models/AvailabilityRule.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { ah } from '../middleware/asyncHandler.js';
import { resolveLocationScope } from './util.js';
import { certifiedLocationIds } from '../services/mappers.js';
import { decertify } from '../services/availabilityService.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const user = (req as AuthedRequest).user!;
  const scope = await resolveLocationScope(user, req.query.locationIds as string | undefined);
  const staff = await User.find({ role: 'staff' });
  const allCerts = await Certification.find({});
  const visible = staff.filter(s => certifiedLocationIds(s.id, allCerts).some(id => scope.includes(id)));
  res.json(visible.map(u => ({ ...u.toJSON(), locationIds: certifiedLocationIds(u.id, allCerts) })));
}));

router.get('/:id/certifications', ah(async (req, res) => {
  const certs = await Certification.find({ staffId: req.params.id }).sort({ validFrom: -1 });
  res.json(certs.map(c => c.toJSON()));
}));

router.get('/:id/availability', ah(async (req, res) => {
  const rules = await AvailabilityRule.find({ staffId: req.params.id });
  res.json(rules.map(r => r.toJSON()));
}));

router.delete('/:id/certifications/:locationId', ah(async (req, res) => {
  await decertify(req.params.id!, req.params.locationId!, (req as AuthedRequest).user!);
  res.status(204).end();
}));

router.patch('/:id/notification-prefs', ah(async (req, res) => {
  const { channel } = req.body as { channel: 'in-app' | 'in-app+email' };
  const user = await User.findByIdAndUpdate(req.params.id, { 'notificationPrefs.channel': channel }, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(user.toJSON());
}));

export default router;

import { Router } from 'express';
import Notification from '../models/Notification.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { ah } from '../middleware/asyncHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/', ah(async (req, res) => {
  const user = (req as AuthedRequest).user!;
  const items = await Notification.find({ userId: user.id }).sort({ createdAt: -1 }).limit(50);
  res.json(items.map(n => n.toJSON()));
}));

router.post('/:id/read', ah(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id }, { $set: { read: true } });
  res.status(204).end();
}));

router.post('/read-all', ah(async (req, res) => {
  const user = (req as AuthedRequest).user!;
  await Notification.updateMany({ userId: user.id }, { $set: { read: true } });
  res.status(204).end();
}));

export default router;

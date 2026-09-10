import { Router } from 'express';
import User from '../models/User.js';
import { signToken, requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { ah } from '../middleware/asyncHandler.js';

const router = Router();

router.post('/login', ah(async (req, res) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) return res.status(400).json({ error: 'userId is required.' });
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'No such demo account.' });
  const token = signToken(user.id);
  res.json({ token, user: user.toJSON() });
}));

router.get('/accounts', ah(async (_req, res) => {
  const users = await User.find().sort({ role: 1, name: 1 });
  res.json(users.map(u => u.toJSON()));
}));

router.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json(req.user!.toJSON());
});

export default router;

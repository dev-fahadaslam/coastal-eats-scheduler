import express, { type Express } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import locationRoutes from './routes/locations.js';
import userRoutes from './routes/users.js';
import shiftRoutes from './routes/shifts.js';
import assignmentRoutes from './routes/assignments.js';
import swapRequestRoutes from './routes/swapRequests.js';
import notificationRoutes from './routes/notifications.js';
import availabilityRoutes from './routes/availability.js';
import dashboardRoutes from './routes/dashboard.js';
import auditRoutes from './routes/audit.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/shifts', shiftRoutes);
  app.use('/api/assignments', assignmentRoutes);
  app.use('/api/swap-requests', swapRequestRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/availability', availabilityRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/audit', auditRoutes);

  app.use(errorHandler);
  return app;
}

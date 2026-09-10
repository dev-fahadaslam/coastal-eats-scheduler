import type { Server, Socket } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';
import Certification from '../models/Certification.js';

interface AuthedSocketData {
  userId: string;
}

export function setupSockets(io: Server): void {
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub);
      if (!user) return next(new Error('unauthorized'));
      (socket.data as AuthedSocketData).userId = user.id as unknown as string;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    void (async () => {
      const userId = (socket.data as AuthedSocketData).userId;
      socket.join(`user:${userId}`);
      const user = await User.findById(userId);
      if (!user) return;
      if (user.role === 'admin') {
        socket.join('location:all');
      } else if (user.role === 'manager') {
        for (const locationId of user.locationIds) socket.join(`location:${locationId}`);
      } else {
        const certs = await Certification.find({ staffId: userId, validTo: null });
        for (const cert of certs) socket.join(`location:${cert.locationId}`);
      }
    })();
  });
}

import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { emitToUser } from '../sockets/bus.js';

export async function notify(userId: string, entry: {
  type: string;
  title: string;
  message: string;
  relatedId?: string | null;
}): Promise<void> {
  const user = await User.findById(userId);
  const doc = await Notification.create({
    userId,
    type: entry.type,
    title: entry.title,
    message: entry.message,
    relatedId: entry.relatedId ?? null,
    createdAt: new Date(),
    read: false,
    emailSimulated: user?.notificationPrefs?.channel === 'in-app+email',
  });
  emitToUser(userId, 'notification', doc.toJSON());
}

import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { idPlugin } from './idPlugin.js';

export interface INotification extends Document {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedId: string | null;
  createdAt: Date;
  read: boolean;
  emailSimulated: boolean;
}

const notificationSchema = new Schema<INotification>({
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  emailSimulated: { type: Boolean, default: false },
});

notificationSchema.plugin(idPlugin);

const Notification: Model<INotification> = mongoose.model<INotification>('Notification', notificationSchema);
export default Notification;

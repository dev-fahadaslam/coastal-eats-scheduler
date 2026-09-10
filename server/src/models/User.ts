import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { idPlugin } from './idPlugin.js';

export type Role = 'admin' | 'manager' | 'staff';
export type NotificationChannel = 'in-app' | 'in-app+email';

export interface IUser extends Document {
  name: string;
  initials: string;
  email: string;
  role: Role;
  title?: string;
  locationIds: string[];
  skills: string[];
  desiredHours?: number;
  notificationPrefs: { channel: NotificationChannel };
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  initials: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['admin', 'manager', 'staff'], required: true },
  title: String,
  locationIds: [String],
  skills: [String],
  desiredHours: Number,
  notificationPrefs: {
    channel: { type: String, enum: ['in-app', 'in-app+email'], default: 'in-app' },
  },
});

userSchema.plugin(idPlugin);

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;

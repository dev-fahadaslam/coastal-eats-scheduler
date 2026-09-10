import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { idPlugin } from './idPlugin.js';

export type AssignmentStatus = 'assigned' | 'called_out' | 'cancelled';

export interface IAssignment extends Document {
  shiftId: string;
  staffId: string;
  status: AssignmentStatus;
  assignedAt: Date;
  assignedBy: string;
  overrideReason: string | null;
}

const assignmentSchema = new Schema<IAssignment>({
  shiftId: { type: String, required: true, index: true },
  staffId: { type: String, required: true, index: true },
  status: { type: String, enum: ['assigned', 'called_out', 'cancelled'], default: 'assigned' },
  assignedAt: { type: Date, default: Date.now },
  assignedBy: { type: String, required: true },
  overrideReason: { type: String, default: null },
});

assignmentSchema.plugin(idPlugin);

const Assignment: Model<IAssignment> = mongoose.model<IAssignment>('Assignment', assignmentSchema);
export default Assignment;

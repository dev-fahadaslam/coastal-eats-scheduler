import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { idPlugin } from './idPlugin.js';

export type ShiftStatus = 'draft' | 'published';

export interface IShift extends Document {
  locationId: string;
  skill: string;
  headcount: number;
  start: Date;
  end: Date;
  status: ShiftStatus;
  version: number;
  tag: string | null;
}

const shiftSchema = new Schema<IShift>({
  locationId: { type: String, required: true, index: true },
  skill: { type: String, required: true },
  headcount: { type: Number, required: true, min: 1 },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  version: { type: Number, default: 1 },
  tag: { type: String, default: null },
});

shiftSchema.plugin(idPlugin);

const Shift: Model<IShift> = mongoose.model<IShift>('Shift', shiftSchema);
export default Shift;

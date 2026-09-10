import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { idPlugin } from './idPlugin.js';

export interface IAvailabilityException extends Document {
  staffId: string;
  locationId: string;
  date: string; // YYYY-MM-DD, location-local calendar day
  type: 'unavailable' | 'available';
  startLocal: string;
  endLocal: string;
}

const availabilityExceptionSchema = new Schema<IAvailabilityException>({
  staffId: { type: String, required: true, index: true },
  locationId: { type: String, required: true },
  date: { type: String, required: true },
  type: { type: String, enum: ['unavailable', 'available'], required: true },
  startLocal: { type: String, default: '00:00' },
  endLocal: { type: String, default: '23:59' },
});

availabilityExceptionSchema.plugin(idPlugin);

const AvailabilityException: Model<IAvailabilityException> = mongoose.model<IAvailabilityException>('AvailabilityException', availabilityExceptionSchema);
export default AvailabilityException;

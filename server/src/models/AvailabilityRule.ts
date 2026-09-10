import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { idPlugin } from './idPlugin.js';

export interface IAvailabilityRule extends Document {
  staffId: string;
  locationId: string;
  dayOfWeek: number;
  startLocal: string;
  endLocal: string;
}

const availabilityRuleSchema = new Schema<IAvailabilityRule>({
  staffId: { type: String, required: true, index: true },
  locationId: { type: String, required: true },
  dayOfWeek: { type: Number, min: 0, max: 6, required: true },
  startLocal: { type: String, required: true },
  endLocal: { type: String, required: true },
});

availabilityRuleSchema.plugin(idPlugin);

const AvailabilityRule: Model<IAvailabilityRule> = mongoose.model<IAvailabilityRule>('AvailabilityRule', availabilityRuleSchema);
export default AvailabilityRule;

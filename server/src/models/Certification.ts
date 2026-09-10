import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { idPlugin } from './idPlugin.js';

export interface ICertification extends Document {
  staffId: string;
  locationId: string;
  validFrom: Date;
  validTo: Date | null;
}

const certificationSchema = new Schema<ICertification>({
  staffId: { type: String, required: true, index: true },
  locationId: { type: String, required: true, index: true },
  validFrom: { type: Date, required: true },
  validTo: { type: Date, default: null },
});

certificationSchema.plugin(idPlugin);

const Certification: Model<ICertification> = mongoose.model<ICertification>('Certification', certificationSchema);
export default Certification;

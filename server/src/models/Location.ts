import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { idPlugin } from './idPlugin.js';

export interface ILocation extends Document {
  name: string;
  city: string;
  timezone: string;
  code: string;
}

const locationSchema = new Schema<ILocation>({
  name: { type: String, required: true },
  city: { type: String, required: true },
  timezone: { type: String, required: true },
  code: { type: String, required: true },
});

locationSchema.plugin(idPlugin);

const Location: Model<ILocation> = mongoose.model<ILocation>('Location', locationSchema);
export default Location;

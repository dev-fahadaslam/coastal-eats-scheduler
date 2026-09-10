import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { idPlugin } from './idPlugin.js';

export type SwapType = 'swap' | 'drop';
export type SwapStatus = 'pending_target' | 'open' | 'pending_manager' | 'approved' | 'rejected' | 'cancelled' | 'expired';

export interface ISwapRequest extends Document {
  type: SwapType;
  requesterId: string;
  assignmentId: string;
  targetStaffId: string | null;
  status: SwapStatus;
  createdAt: Date;
  respondedAt: Date | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  reason: string | null;
}

const swapRequestSchema = new Schema<ISwapRequest>({
  type: { type: String, enum: ['swap', 'drop'], required: true },
  requesterId: { type: String, required: true, index: true },
  assignmentId: { type: String, required: true },
  targetStaffId: { type: String, default: null },
  status: {
    type: String,
    enum: ['pending_target', 'open', 'pending_manager', 'approved', 'rejected', 'cancelled', 'expired'],
    default: 'pending_target',
  },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date, default: null },
  decidedAt: { type: Date, default: null },
  decidedBy: { type: String, default: null },
  reason: { type: String, default: null },
});

swapRequestSchema.plugin(idPlugin);

const SwapRequest: Model<ISwapRequest> = mongoose.model<ISwapRequest>('SwapRequest', swapRequestSchema);
export default SwapRequest;

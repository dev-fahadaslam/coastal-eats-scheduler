import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { idPlugin } from './idPlugin.js';

export interface IAuditLog extends Document {
  at: Date;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  locationId: string | null;
  before: unknown;
  after: unknown;
  summary: string;
}

const auditLogSchema = new Schema<IAuditLog>({
  at: { type: Date, default: Date.now, index: true },
  actorId: { type: String, required: true },
  actorName: { type: String, required: true },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: String, required: true },
  locationId: { type: String, default: null, index: true },
  before: { type: Schema.Types.Mixed, default: null },
  after: { type: Schema.Types.Mixed, default: null },
  summary: { type: String, required: true },
});

auditLogSchema.plugin(idPlugin);

const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLog;

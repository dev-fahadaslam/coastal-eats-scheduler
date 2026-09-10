import AuditLog from '../models/AuditLog.js';
import type { IUser } from '../models/User.js';

export async function recordAudit(actor: IUser, entry: {
  action: string;
  entity: string;
  entityId: string;
  locationId?: string | null;
  before?: unknown;
  after?: unknown;
  summary: string;
}): Promise<void> {
  await AuditLog.create({
    at: new Date(),
    actorId: actor.id,
    actorName: actor.name,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    locationId: entry.locationId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    summary: entry.summary,
  });
}

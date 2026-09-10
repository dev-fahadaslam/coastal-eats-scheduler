import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';
import { ah } from '../middleware/asyncHandler.js';
import { resolveLocationScope } from './util.js';

const router = Router();
router.use(requireAuth);

function buildQuery(scope: string[], from?: string, to?: string) {
  const query: Record<string, unknown> = {
    $or: [{ locationId: { $in: scope } }, { locationId: null }],
  };
  if (from || to) {
    const at: Record<string, Date> = {};
    if (from) at.$gte = new Date(from);
    if (to) at.$lte = new Date(`${to}T23:59:59.999Z`);
    query.at = at;
  }
  return query;
}

router.get('/', ah(async (req, res) => {
  const scope = await resolveLocationScope((req as AuthedRequest).user!, req.query.locationIds as string | undefined);
  const query = buildQuery(scope, req.query.from as string | undefined, req.query.to as string | undefined);
  const entries = await AuditLog.find(query).sort({ at: -1 }).limit(500);
  res.json(entries.map(e => e.toJSON()));
}));

router.get('/export.csv', requireRole('admin'), ah(async (req, res) => {
  const scope = await resolveLocationScope((req as AuthedRequest).user!, req.query.locationIds as string | undefined);
  const query = buildQuery(scope, req.query.from as string | undefined, req.query.to as string | undefined);
  const entries = await AuditLog.find(query).sort({ at: -1 });

  const header = ['Timestamp', 'Actor', 'Action', 'Location', 'Entity', 'Entity ID', 'Summary'];
  const rows = entries.map(e => [e.at.toISOString(), e.actorName, e.action, e.locationId ?? '', e.entity, e.entityId, e.summary]);
  const csv = [header, ...rows]
    .map(line => line.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="coastal-eats-audit-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}));

export default router;

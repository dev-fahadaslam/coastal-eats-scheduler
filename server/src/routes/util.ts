import type { IUser } from '../models/User.js';
import { visibleLocationIds } from '../services/scheduleService.js';

export async function resolveLocationScope(user: IUser, requested?: string): Promise<string[]> {
  const visible = await visibleLocationIds(user);
  if (!requested) return visible;
  const requestedIds = requested.split(',').map(s => s.trim()).filter(Boolean);
  return requestedIds.filter(id => visible.includes(id));
}

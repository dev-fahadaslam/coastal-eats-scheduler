import AvailabilityRule from '../models/AvailabilityRule.js';
import AvailabilityException from '../models/AvailabilityException.js';
import Certification from '../models/Certification.js';
import User, { type IUser } from '../models/User.js';
import { recordAudit } from './auditService.js';
import { notify } from './notificationService.js';
import { ConstraintError } from './errors.js';

export async function setAvailability(input: {
  staffId: string;
  rules: { locationId: string; dayOfWeek: number; startLocal: string; endLocal: string }[];
  exceptions: { locationId: string; date: string; type: 'unavailable' | 'available'; startLocal?: string; endLocal?: string }[];
}): Promise<void> {
  const { staffId, rules, exceptions } = input;
  await AvailabilityRule.deleteMany({ staffId });
  await AvailabilityRule.insertMany(rules.map(r => ({ staffId, ...r })));
  await AvailabilityException.deleteMany({ staffId });
  await AvailabilityException.insertMany(exceptions.map(e => ({ staffId, startLocal: '00:00', endLocal: '23:59', ...e })));

  const staff = await User.findById(staffId);
  const managers = await User.find({ role: { $in: ['manager', 'admin'] } });
  for (const manager of managers) {
    await notify(manager.id, {
      type: 'availability_changed', title: 'Availability updated',
      message: `${staff?.name ?? 'A staff member'} updated their availability.`, relatedId: staffId,
    });
  }
}

export async function decertify(staffId: string, locationId: string, actor: IUser): Promise<void> {
  const cert = await Certification.findOne({ staffId, locationId, validTo: null });
  if (!cert) throw new ConstraintError('No active certification found to remove.');
  cert.validTo = new Date();
  await cert.save();

  const staff = await User.findById(staffId);
  await recordAudit(actor, {
    action: 'decertify', entity: 'certification', entityId: `${staffId}:${locationId}`, locationId,
    before: { validTo: null }, after: { validTo: cert.validTo },
    summary: `Removed ${staff?.name ?? staffId}'s certification at this location. Past shifts remain on record.`,
  });
}

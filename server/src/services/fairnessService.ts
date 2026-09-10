import User from '../models/User.js';
import Shift from '../models/Shift.js';
import Assignment from '../models/Assignment.js';
import Location from '../models/Location.js';
import Certification from '../models/Certification.js';
import { fairnessReport } from '../domain/domain.js';
import { certifiedLocationIds } from './mappers.js';

export async function buildFairnessReport(locationIds: string[], sinceDate?: string) {
  const allStaff = await User.find({ role: 'staff' });
  const allCerts = await Certification.find({});
  const staff = allStaff.filter(s => certifiedLocationIds(s.id, allCerts).some(id => locationIds.includes(id)));

  const shifts = await Shift.find({ locationId: { $in: locationIds } });
  const shiftIds = shifts.map(s => s.id);
  const assignments = await Assignment.find({ shiftId: { $in: shiftIds } });
  const locations = await Location.find({ _id: { $in: locationIds } });
  const locationsById = new Map(locations.map(l => [l.id, { timezone: l.timezone }]));

  return fairnessReport({
    staff: staff.map(s => ({ id: s.id, name: s.name, desiredHours: s.desiredHours })),
    assignments: assignments.map(a => ({ staffId: a.staffId, shiftId: a.shiftId, status: a.status })),
    shifts: shifts.map(s => ({ id: s.id, locationId: s.locationId, start: s.start.toISOString(), end: s.end.toISOString() })),
    locationsById,
    sinceDate,
  });
}

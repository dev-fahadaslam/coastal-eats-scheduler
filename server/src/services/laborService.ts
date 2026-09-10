import Shift from '../models/Shift.js';
import Assignment from '../models/Assignment.js';
import Location from '../models/Location.js';
import { laborSummary } from '../domain/cost.js';

export async function buildLaborSummary(locationIds: string[], staffFilterIds?: string[]) {
  const shifts = await Shift.find({ locationId: { $in: locationIds } });
  const shiftIds = shifts.map(s => s.id);
  const assignments = await Assignment.find({ shiftId: { $in: shiftIds } });
  const locations = await Location.find({ _id: { $in: locationIds } });
  const locationsById = new Map(locations.map(l => [l.id, { timezone: l.timezone }]));

  return laborSummary({
    assignments: assignments.map(a => ({ staffId: a.staffId, shiftId: a.shiftId, status: a.status })),
    shifts: shifts.map(s => ({ id: s.id, locationId: s.locationId, skill: s.skill, start: s.start.toISOString(), end: s.end.toISOString() })),
    locationIds,
    staffFilterIds,
    locationsById,
  });
}

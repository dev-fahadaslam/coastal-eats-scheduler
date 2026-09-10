import 'dotenv/config';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Location from './models/Location.js';
import Certification from './models/Certification.js';
import AvailabilityRule from './models/AvailabilityRule.js';
import AvailabilityException from './models/AvailabilityException.js';
import Shift from './models/Shift.js';
import Assignment from './models/Assignment.js';
import SwapRequest from './models/SwapRequest.js';
import Notification from './models/Notification.js';
import AuditLog from './models/AuditLog.js';
import { buildSeedData } from './seedData.js';

async function run(): Promise<void> {
  const { stop } = await connectDB();
  console.log('Seeding ShiftSync…');

  await Promise.all([
    User.deleteMany({}), Location.deleteMany({}), Certification.deleteMany({}),
    AvailabilityRule.deleteMany({}), AvailabilityException.deleteMany({}),
    Shift.deleteMany({}), Assignment.deleteMany({}), SwapRequest.deleteMany({}),
    Notification.deleteMany({}), AuditLog.deleteMany({}),
  ]);

  const seed = buildSeedData(new Date());

  const locations = await Location.insertMany(seed.locations);
  const locationIdByCode = new Map(seed.locations.map((l, i) => [l.tempId, locations[i]!.id]));
  const remapLoc = (tempId: string) => locationIdByCode.get(tempId)!;

  const users = await User.insertMany(seed.users.map(u => ({ ...u, locationIds: u.locationIds.map(remapLoc) })));
  const userIdByTemp = new Map(seed.users.map((u, i) => [u.tempId, users[i]!.id]));
  const remapUser = (tempId: string) => userIdByTemp.get(tempId)!;

  await Certification.insertMany(seed.certifications.map(c => ({
    staffId: remapUser(c.staffId), locationId: remapLoc(c.locationId), validFrom: c.validFrom, validTo: c.validTo,
  })));
  await AvailabilityRule.insertMany(seed.availabilityRules.map(r => ({
    staffId: remapUser(r.staffId), locationId: remapLoc(r.locationId), dayOfWeek: r.dayOfWeek, startLocal: r.startLocal, endLocal: r.endLocal,
  })));
  await AvailabilityException.insertMany(seed.availabilityExceptions.map(e => ({
    staffId: remapUser(e.staffId), locationId: remapLoc(e.locationId), date: e.date, type: e.type,
  })));

  const shiftDocs = await Shift.insertMany(seed.shifts.map(s => ({
    locationId: remapLoc(s.locationId), skill: s.skill, headcount: s.headcount,
    start: s.start, end: s.end, status: s.status, version: 1, tag: s.tag,
  })));
  const shiftIdByTemp = new Map(seed.shifts.map((s, i) => [s.tempId, shiftDocs[i]!.id]));

  const assignmentDocs = await Assignment.insertMany(seed.assignments.map(a => ({
    shiftId: shiftIdByTemp.get(a.shiftTempId)!, staffId: remapUser(a.staffId), status: 'assigned',
    assignedAt: a.start, assignedBy: remapUser(a.assignedByTemp),
  })));
  const assignmentIdByKey = new Map(seed.assignments.map((a, i) => [`${a.shiftTempId}:${a.staffId}`, assignmentDocs[i]!.id]));

  for (const req of seed.swapRequests) {
    await SwapRequest.create({
      type: req.type,
      requesterId: remapUser(req.requesterId),
      assignmentId: assignmentIdByKey.get(req.assignmentKey)!,
      targetStaffId: req.targetStaffId ? remapUser(req.targetStaffId) : null,
      status: req.status,
      createdAt: req.createdAt,
      respondedAt: req.respondedAt,
    });
  }

  for (const n of seed.notifications) {
    await Notification.create({
      userId: remapUser(n.userId), type: n.type, title: n.title, message: n.message,
      createdAt: n.createdAt, read: false,
    });
  }

  for (const a of seed.auditEntries) {
    await AuditLog.create({
      at: a.at, actorId: remapUser(a.actorId), actorName: a.actorName, action: a.action,
      entity: a.entity, entityId: remapLoc(a.entityLocationTemp), locationId: remapLoc(a.entityLocationTemp), summary: a.summary,
    });
  }

  console.log(`Seeded ${locations.length} locations, ${users.length} users, ${shiftDocs.length} shifts, ${assignmentDocs.length} assignments.`);
  await stop();
}

run().catch(err => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});

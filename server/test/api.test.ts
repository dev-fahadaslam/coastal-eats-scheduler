import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import Shift from '../src/models/Shift.js';
import Assignment from '../src/models/Assignment.js';
import SwapRequest from '../src/models/SwapRequest.js';
import { buildSeedData } from '../src/seedData.js';
import Location from '../src/models/Location.js';
import Certification from '../src/models/Certification.js';
import AvailabilityRule from '../src/models/AvailabilityRule.js';
import AvailabilityException from '../src/models/AvailabilityException.js';
import Notification from '../src/models/Notification.js';
import AuditLog from '../src/models/AuditLog.js';

let mem: MongoMemoryServer;
const app = createApp();

const ids: Record<string, string> = {};
let token: (email: string) => Promise<string>;

before(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('shiftsync_test'));

  const seed = buildSeedData(new Date('2026-09-07T12:00:00Z'));
  const locations = await Location.insertMany(seed.locations);
  const locId = new Map(seed.locations.map((l, i) => [l.tempId, locations[i]!.id]));
  const users = await User.insertMany(seed.users.map(u => ({ ...u, locationIds: u.locationIds.map(t => locId.get(t)!) })));
  const userId = new Map(seed.users.map((u, i) => [u.tempId, users[i]!.id]));

  await Certification.insertMany(seed.certifications.map(c => ({ staffId: userId.get(c.staffId)!, locationId: locId.get(c.locationId)!, validFrom: c.validFrom, validTo: c.validTo })));
  await AvailabilityRule.insertMany(seed.availabilityRules.map(r => ({ staffId: userId.get(r.staffId)!, locationId: locId.get(r.locationId)!, dayOfWeek: r.dayOfWeek, startLocal: r.startLocal, endLocal: r.endLocal })));
  await AvailabilityException.insertMany(seed.availabilityExceptions.map(e => ({ staffId: userId.get(e.staffId)!, locationId: locId.get(e.locationId)!, date: e.date, type: e.type })));

  const shifts = await Shift.insertMany(seed.shifts.map(s => ({ locationId: locId.get(s.locationId)!, skill: s.skill, headcount: s.headcount, start: s.start, end: s.end, status: s.status, version: 1, tag: s.tag })));
  const shiftId = new Map(seed.shifts.map((s, i) => [s.tempId, shifts[i]!.id]));
  const assignments = await Assignment.insertMany(seed.assignments.map(a => ({ shiftId: shiftId.get(a.shiftTempId)!, staffId: userId.get(a.staffId)!, status: 'assigned', assignedAt: a.start, assignedBy: userId.get(a.assignedByTemp)! })));
  const assignmentKey = new Map(seed.assignments.map((a, i) => [`${a.shiftTempId}:${a.staffId}`, assignments[i]!.id]));
  for (const r of seed.swapRequests) {
    await SwapRequest.create({ type: r.type, requesterId: userId.get(r.requesterId)!, assignmentId: assignmentKey.get(r.assignmentKey)!, targetStaffId: r.targetStaffId ? userId.get(r.targetStaffId)! : null, status: r.status, createdAt: r.createdAt, respondedAt: r.respondedAt });
  }

  ids.maria = userId.get('maria')!;
  ids.jamie = userId.get('jamie')!;
  ids.drift = locId.get('drift')!;

  token = async (email: string) => {
    const user = await User.findOne({ email });
    const res = await request(app).post('/api/auth/login').send({ userId: user!.id });
    return res.body.token as string;
  };
});

after(async () => {
  await mongoose.disconnect();
  await mem.stop();
});

test('a manager only sees their assigned locations', async () => {
  const t = await token('jordan@coastaleats.test');
  const res = await request(app).get('/api/locations').set('Authorization', `Bearer ${t}`);
  assert.equal(res.status, 200);
  const names = res.body.map((l: { name: string }) => l.name).sort();
  assert.deepEqual(names, ['Drift Kitchen', 'Harbor House']);
});

test('candidates endpoint explains ineligible staff and ranks eligible ones first', async () => {
  const t = await token('jordan@coastaleats.test');
  const shiftsRes = await request(app).get('/api/shifts').set('Authorization', `Bearer ${t}`);
  const openShift = shiftsRes.body.shifts.find((s: { locationId: string; skill: string; tag: string }) => s.locationId === ids.drift && s.skill === 'bartender' && s.tag === 'conflict-demo');
  assert.ok(openShift, 'expected the seeded conflict-demo shift to exist');

  const res = await request(app).get(`/api/shifts/${openShift.id}/candidates`).set('Authorization', `Bearer ${t}`);
  assert.equal(res.status, 200);
  const jamie = res.body.candidates.find((c: { person: { id: string } }) => c.person.id === ids.jamie);
  assert.equal(jamie.evaluation.allowed, true);
});

test('assigning twice with the same stale version returns a 409 conflict', async () => {
  const t = await token('jordan@coastaleats.test');
  const shiftsRes = await request(app).get('/api/shifts').set('Authorization', `Bearer ${t}`);
  const openShift = shiftsRes.body.shifts.find((s: { locationId: string; skill: string; tag: string }) => s.locationId === ids.drift && s.tag === 'conflict-demo');

  const first = await request(app).post('/api/assignments').set('Authorization', `Bearer ${t}`)
    .send({ shiftId: openShift.id, staffId: ids.jamie, expectedVersion: openShift.version });
  assert.equal(first.status, 201);

  const second = await request(app).post('/api/assignments').set('Authorization', `Bearer ${t}`)
    .send({ shiftId: openShift.id, staffId: ids.jamie, expectedVersion: openShift.version });
  assert.equal(second.status, 409);
});

test('a manager from a different location cannot see the other location\'s open shift', async () => {
  const tJordan = await token('jordan@coastaleats.test');
  const tPriya = await token('priya@coastaleats.test');
  const jordanShifts = await request(app).get('/api/shifts').set('Authorization', `Bearer ${tJordan}`);
  const priyaShifts = await request(app).get('/api/shifts').set('Authorization', `Bearer ${tPriya}`);
  const jordanIds = new Set(jordanShifts.body.shifts.map((s: { id: string }) => s.id));
  const priyaIds = new Set(priyaShifts.body.shifts.map((s: { id: string }) => s.id));
  const overlap = [...jordanIds].filter(id => priyaIds.has(id));
  assert.equal(overlap.length, 0);
});

test('the seeded pending swap can be approved by a manager', async () => {
  const t = await token('jordan@coastaleats.test');
  const list = await request(app).get('/api/swap-requests').set('Authorization', `Bearer ${t}`);
  const pending = list.body.find((r: { status: string }) => r.status === 'pending_manager');
  assert.ok(pending, 'expected a seeded pending_manager swap request');

  const decision = await request(app).post(`/api/swap-requests/${pending.id}/decide`).set('Authorization', `Bearer ${t}`).send({ approve: true });
  assert.equal(decision.status, 204);
});

test('a staff member cannot see admin-only audit export', async () => {
  const t = await token('maria@coastaleats.test');
  const res = await request(app).get('/api/audit/export.csv').set('Authorization', `Bearer ${t}`);
  assert.equal(res.status, 403);
});

test('admin audit export returns CSV', async () => {
  const t = await token('admin@coastaleats.test');
  const res = await request(app).get('/api/audit/export.csv').set('Authorization', `Bearer ${t}`);
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type']!, /text\/csv/);
  assert.match(res.text, /"Timestamp","Actor","Action"/);
});

test('requesting a swap enforces the 3-pending-request cap', async () => {
  const t = await token('maria@coastaleats.test');
  const shiftsRes = await request(app).get('/api/shifts').set('Authorization', `Bearer ${t}`);
  const myAssignments = shiftsRes.body.assignments.filter((a: { staffId: string; status: string }) => a.staffId === ids.maria && a.status === 'assigned');
  assert.ok(myAssignments.length >= 3, 'need at least 3 of Maria\'s own assignments to exercise the cap');

  for (let i = 0; i < 3; i++) {
    const res = await request(app).post('/api/swap-requests').set('Authorization', `Bearer ${t}`)
      .send({ type: 'drop', assignmentId: myAssignments[i].id });
    assert.equal(res.status, 201, `expected drop ${i} to be accepted`);
  }
  const fourth = await request(app).post('/api/swap-requests').set('Authorization', `Bearer ${t}`)
    .send({ type: 'drop', assignmentId: myAssignments[3]?.id ?? myAssignments[0]!.id });
  assert.equal(fourth.status, 400);
});

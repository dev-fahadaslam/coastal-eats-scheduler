import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAssignment, eligibleCandidates, assertVersion, isWithinAvailability,
  consecutiveDaysEndingAt, isPremiumShift, canFileNewRequest, isDropExpired, canEditShift,
} from '../src/domain/domain.js';
import type { CandidateLike, ShiftLike } from '../src/domain/types.js';

test('allows a qualified, unconflicted candidate', () => {
  const person: CandidateLike = { id: 'a', skills: ['bartender'], locations: ['one'] };
  const shift: ShiftLike = { locationId: 'one', skill: 'bartender', start: '2026-10-14T16:00:00Z', end: '2026-10-14T23:00:00Z' };
  assert.equal(evaluateAssignment({ shift, candidate: person, assignments: [] }).allowed, true);
});

test('blocks double-booking for the same person', () => {
  const person: CandidateLike = { id: 'a', skills: ['bartender'], locations: ['one'] };
  const shift: ShiftLike = { locationId: 'one', skill: 'bartender', start: '2026-10-14T16:00:00Z', end: '2026-10-14T23:00:00Z' };
  const result = evaluateAssignment({
    shift, candidate: person,
    assignments: [{ staffId: 'a', start: '2026-10-14T20:00:00Z', end: '2026-10-14T23:00:00Z' }],
  });
  assert.equal(result.allowed, false);
  assert.match(result.issues.join(' '), /Double-booking/);
});

test('blocks a shift starting less than 10 hours after the prior one ends', () => {
  const person: CandidateLike = { id: 'a', skills: ['server'], locations: ['one'] };
  const shift: ShiftLike = { locationId: 'one', skill: 'server', start: '2026-10-14T09:00:00Z', end: '2026-10-14T15:00:00Z' };
  const result = evaluateAssignment({
    shift, candidate: person,
    assignments: [{ staffId: 'a', start: '2026-10-13T22:00:00Z', end: '2026-10-14T02:00:00Z' }],
  });
  assert.equal(result.allowed, false);
  assert.match(result.issues.join(' '), /Minimum rest/);
});

test('missing skill and missing certification are both reported', () => {
  const person: CandidateLike = { id: 'a', skills: ['host'], locations: ['two'] };
  const shift: ShiftLike = { locationId: 'one', skill: 'bartender', start: '2026-10-14T16:00:00Z', end: '2026-10-14T23:00:00Z' };
  const result = evaluateAssignment({ shift, candidate: person, assignments: [] });
  assert.equal(result.allowed, false);
  assert.equal(result.issues.length, 2);
});

test('hard-blocks over 12 projected hours in a single day', () => {
  const person: CandidateLike = { id: 'a', skills: ['server'], locations: ['one'] };
  const shift: ShiftLike = { locationId: 'one', skill: 'server', start: '2026-10-14T18:00:00Z', end: '2026-10-15T02:00:00Z' };
  const result = evaluateAssignment({
    shift, candidate: person,
    assignments: [{ staffId: 'a', start: '2026-10-14T08:00:00Z', end: '2026-10-14T15:00:00Z' }],
  });
  assert.equal(result.allowed, false);
  assert.match(result.issues.join(' '), /Daily-hours hard block/);
});

test('availability is checked in the shift location\'s own time zone', () => {
  const rules = [{ dayOfWeek: 3, startLocal: '09:00', endLocal: '17:00' }];
  const ok = isWithinAvailability({ start: '2026-10-14T13:00:00Z', end: '2026-10-14T16:00:00Z', timezone: 'America/New_York', rules });
  assert.equal(ok.ok, true);
  const wrongZone = isWithinAvailability({ start: '2026-10-14T13:00:00Z', end: '2026-10-14T16:00:00Z', timezone: 'America/Los_Angeles', rules });
  assert.equal(wrongZone.ok, false);
});

test('an overnight shift is evaluated as one continuous interval', () => {
  const rules = [{ dayOfWeek: 5, startLocal: '18:00', endLocal: '02:00' }];
  const result = isWithinAvailability({ start: '2026-10-17T06:00:00Z', end: '2026-10-17T09:00:00Z', timezone: 'America/Los_Angeles', rules });
  assert.equal(result.ok, true);
});

test('consecutive days count a 1-hour shift the same as a long one', () => {
  const worked = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'];
  assert.equal(consecutiveDaysEndingAt('a', '2026-10-15', worked), 6);
});

test('Friday and Saturday evening shifts are tagged premium', () => {
  const fridayEvening = { start: '2026-10-16T23:00:00Z', end: '2026-10-17T03:00:00Z' };
  const mondayMorning = { start: '2026-10-12T13:00:00Z', end: '2026-10-12T20:00:00Z' };
  assert.equal(isPremiumShift(fridayEvening, 'America/New_York'), true);
  assert.equal(isPremiumShift(mondayMorning, 'America/New_York'), false);
});

test('a shift starting at noon but running into Friday evening is still premium', () => {
  const fridayNoonToMidnight = { start: '2026-10-16T16:00:00Z', end: '2026-10-17T04:00:00Z' };
  assert.equal(isPremiumShift(fridayNoonToMidnight, 'America/New_York'), true);
});

test('a 4th active swap/drop request is blocked', () => {
  const active = ['pending_target', 'open', 'pending_manager'].map(status => ({ requesterId: 'a', status }));
  assert.equal(canFileNewRequest('a', active), false);
  assert.equal(canFileNewRequest('a', active.slice(0, 2)), true);
});

test('a drop request expires 24 hours before the shift', () => {
  const now = new Date('2026-10-14T00:00:00Z');
  assert.equal(isDropExpired({ start: '2026-10-14T20:00:00Z' }, now), true);
  assert.equal(isDropExpired({ start: '2026-10-16T20:00:00Z' }, now), false);
});

test('a shift cannot be edited inside the 48-hour publish cutoff', () => {
  const now = new Date('2026-10-14T00:00:00Z');
  assert.equal(canEditShift({ start: '2026-10-15T12:00:00Z' }, now), false);
  assert.equal(canEditShift({ start: '2026-10-20T12:00:00Z' }, now), true);
});

test('assertVersion throws on a stale write', () => {
  assert.throws(() => assertVersion(2, 1));
  assert.doesNotThrow(() => assertVersion(2, 2));
});

test('eligibleCandidates surfaces ineligible people with reasons, ranked after eligible ones', () => {
  const staff: CandidateLike[] = [
    { id: 'sarah', skills: ['server'], locations: ['one'], availability: [{ dayOfWeek: 2, startLocal: '00:00', endLocal: '01:00' }] },
    { id: 'john', skills: ['server'], locations: ['one'], availability: [] },
  ];
  const shift: ShiftLike = { locationId: 'one', skill: 'server', start: '2026-10-14T16:00:00Z', end: '2026-10-14T23:00:00Z', timezone: 'America/New_York' };
  const results = eligibleCandidates(shift, staff, []);
  assert.equal(results[0]!.person.id, 'john');
  assert.equal(results[0]!.evaluation.allowed, true);
  assert.equal(results[1]!.evaluation.allowed, false);
});

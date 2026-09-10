# ShiftSync

A shift-scheduling platform for a fictional four-location restaurant group, Coastal Eats —
built as a real **MERN** application (MongoDB, Express, React, Node), fully in **TypeScript**
on both ends. Every rule in the brief — skills, certifications, availability, rest, overtime,
consecutive days, swap/drop workflows, fairness, audit — is enforced by real server-side code
(`server/src/domain/`), unit- and integration-tested, not mocked.

```
/server   Express API + MongoDB (Mongoose) + Socket.IO, TypeScript
/client   React (Vite) single-page app, TypeScript
```

## Running it

```bash
npm install                       # installs both workspaces
npm run seed --workspace=server   # wipes and re-seeds realistic demo data
npm run dev                       # runs API (4000) and client (5173) together
```

Then open **http://localhost:5173**. `npm run dev` uses the root's `concurrently` script; you
can also run `npm run dev --workspace=server` and `npm run dev --workspace=client` in separate
terminals.

No database setup is required: if `MONGODB_URI` isn't set, the server auto-manages a real
MongoDB binary in-process via `mongodb-memory-server`, persisted to `server/.mongo-data` so
data survives restarts on the same machine. Point `MONGODB_URI` at a real `mongod` or an Atlas
cluster for anything beyond local development (see `server/.env.example`).

## Testing

```bash
npm test --workspace=server
```

23 tests: 15 unit tests against the pure constraint engine (`server/test/domain.test.ts`) and
8 integration tests hitting the real Express app with an ephemeral MongoDB via `supertest`
(`server/test/api.test.ts`) — covering location scoping, candidate ranking, optimistic-
concurrency conflicts, swap approval, the pending-request cap, and audit export permissions.

Typecheck either side with `npm run typecheck --workspace=server` or `--workspace=client`.

## Logging in

The login screen lists every demo account grouped by role — pick one, no password required
(see *Assumptions* below).

| Role | Try | What you'll see |
|---|---|---|
| **Admin** | Alex Rivera | All four locations; can override the 48h edit lock and export the audit log. |
| **Manager** | Jordan Miller (Harbor House + Drift Kitchen — spans both time zones) or Priya Patel (The Rooftop + Salt & Pine) | Only their assigned locations; builds shifts, runs smart coverage, approves swaps. |
| **Staff** | Maria Park, Jamie Chen, Sam Rivera, or any other staff account | Their own schedule, the open-shift marketplace, swap/drop requests, and their availability. |

## Walking through the evaluation scenarios

- **Sunday Night Chaos** — as a staff member, go to *My schedule* and click **Can't make it**
  on any shift. Their manager gets a real-time notification over the WebSocket connection;
  *Overview* shows a priority-action card with **Find qualified coverage**, which ranks every
  candidate against skills/certification/availability/rest/overtime and explains why each
  ineligible person was skipped.
- **The Overtime Trap** — *Overview*'s labor outlook and the smart-coverage modal both show
  projected daily/weekly hours live, before an assignment is confirmed; assignment is
  hard-blocked past 12 hours in a day or a 7th consecutive day without an override.
- **The Timezone Tangle** — Sam Rivera is certified at Drift Kitchen (Pacific) and Harbor
  House (Eastern) with two independent "9am-5pm" rules, one per location (*Availability*
  while signed in as Sam). A rule only ever applies at the location it was set for
  (`isWithinAvailability` in `server/src/domain/domain.ts`).
- **The Simultaneous Assignment** — sign in as Jordan Miller in one browser tab and Priya
  Patel in another (any two devices work now — this goes through MongoDB and a real
  Socket.IO server, not a browser-local trick). Both open **Find coverage** on the Friday-
  evening bartender shift at their own location; both see Jamie Chen (certified at both) as
  eligible. Assign her from one tab — the other tab's candidate list updates live over the
  socket and shows her as ineligible with the exact conflicting shift, no refresh needed.
  Try it twice quickly and the loser gets a clean 409 conflict from MongoDB's atomic
  `findOneAndUpdate` version check, not a race condition.
- **The Fairness Complaint** — *Fairness* computes a real premium-shift (Fri/Sat evening)
  distribution and desired-vs-actual hours gap per person from actual assignment data.
- **The Regret Swap** — as one staff member, request a swap targeted at a specific teammate.
  As that teammate, accept it. As the original requester, cancel it before a manager
  approves — the target is notified, the original assignment never moved, and the audit log
  records the cancellation.

## Architecture choices

- **Time.** Every instant is stored as a real `Date`/UTC in MongoDB; every location carries an
  IANA time zone. Availability rules are wall-clock, evaluated in the *shift's own location's*
  time zone via `Intl.DateTimeFormat`, so a recurring rule automatically stays correct across a
  DST transition without manual offset math (`server/src/domain/time.ts`). An overnight shift
  is one continuous interval — its constraint checks never split at midnight.
- **Concurrency.** Every mutating write re-reads the shift's current `version` and applies its
  change via a single atomic `Shift.findOneAndUpdate({_id, version: expected}, {$inc:{version:1}, ...})`.
  MongoDB guarantees only one of two racing writers can match that filter — the loser gets a
  clean `409` conflict (`ConflictError`) instead of silently overbooking. This is real,
  cross-device optimistic concurrency, not simulated.
- **Real-time.** Socket.IO pushes two event types: `notification` (to the specific recipient's
  room) and `shift-update` (broadcast to everyone connected, since a change to one location's
  shift can affect assignment *eligibility* — double-booking, rest, weekly hours — for a
  cross-certified staff member being considered at a completely different location; scoping
  the broadcast to one location's room would miss that ripple). Clients refetch the relevant
  data on `shift-update` rather than trusting a partial payload, which keeps the client
  simple and always consistent with the server.
- **Auth.** A JWT is issued on login and required on every API call (`server/src/middleware/auth.ts`).
  "Logging in" is picking one of the seeded demo accounts rather than a password — a
  documented, deliberate scope decision (see *Assumptions*); the token itself, its
  verification, and the role/location scoping it gates are all real.
- **Domain logic stays framework-agnostic.** `server/src/domain/*.ts` has zero dependency on
  Express or Mongoose — it's pure functions over plain objects, unit-tested directly. The
  `services/` layer fetches Mongoose documents, maps them to those plain shapes
  (`services/mappers.ts`), calls the pure functions, then persists results. This is also why
  the original prototype's business logic ported over almost unchanged.
- **Swaps.** Original assignments stay authoritative until a manager approves — nothing moves
  until then. A shift edit auto-cancels any swap it's in the middle of, notifying every party.
  A requester can cancel any unapproved request. Pending requests are capped at three per
  person; unclaimed drops expire 24 hours before the shift (checked opportunistically whenever
  the swap-requests list is read, since this prototype has no background job runner).
- **Audit.** Every mutating action appends an immutable before/after record in
  `server/src/services/auditService.ts`, called from the same service function as the change
  it's logging. Admins can filter by date range and location and export CSV.
- **Cost estimate.** The brief doesn't specify wage rates, so `server/src/domain/cost.ts`
  assigns a flat rate per skill and a 1.5x overtime premium past 40 hours/week, purely to make
  the overtime dashboard's dollar figures legible — it isn't a real payroll calculation.

## Documented assumptions (ambiguities called out in the brief)

- **De-certifying a location** ends future eligibility but never touches history: past
  shifts, assignments, and audit entries referencing that person/location are untouched
  (`Certification` carries `validFrom`/`validTo` rather than being deleted).
- **Desired hours vs. availability** are independent: availability is a hard constraint
  (can't be scheduled outside it), desired hours is a soft target the fairness report
  compares actual hours against.
- **Consecutive days**: any shift, regardless of length, counts a calendar day as "worked" in
  the shift's own location time zone — a 1-hour shift and an 11-hour shift count the same
  toward the 6th/7th-consecutive-day rules; only accumulated *hours* (daily/weekly overtime)
  distinguish short shifts from long ones.
- **Editing a shift after a swap is approved**: the new assignment is indistinguishable from
  any direct assignment from that point on. Editing the shift later follows the normal
  48-hour cutoff rule and applies to whoever currently holds it.
- **A location spanning a time-zone boundary**: out of scope for this prototype — each
  location has exactly one governing IANA zone, chosen to match its posted operating hours.
- **Authentication** is represented as a role/account picker with no password, since the
  brief's focus is scheduling logic, not an auth system — the JWT issued is real, but nothing
  gates who can request one for a given account.

## Known limitations

- `mongodb-memory-server`'s default mode is meant for local development/testing, not a
  production deployment — point `MONGODB_URI` at a real MongoDB instance (local or Atlas)
  before deploying.
- One week of seed data is generated relative to whenever it's seeded; there's no next/prev-
  week navigation or ability to seed further weeks from the UI.
- No real email is sent; the "in-app + email" notification preference only tags notifications
  as simulated-emailed in the notification panel.
- The fairness report's date-range is currently fixed to the seeded week, since there's only
  one week of data to compare against.
- Expired-drop cleanup runs opportunistically on read rather than via a scheduled job.

## Data model

`users`, `locations(timezone)`, `certifications(validFrom, validTo)`, `availabilityRules`,
`availabilityExceptions`, `shifts(version, status)`, `assignments`, `swapRequests`,
`notifications`, `auditLogs` — one MongoDB collection per Mongoose model in `server/src/models/`.

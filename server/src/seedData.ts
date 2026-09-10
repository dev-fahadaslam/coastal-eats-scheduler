import { zonedTimeToUTC, mondayOf, localParts } from './domain/time.js';
import type { Role, NotificationChannel } from './models/User.js';

export interface SeedLocation { tempId: string; name: string; city: string; timezone: string; code: string }
export interface SeedUser {
  tempId: string; name: string; initials: string; email: string; role: Role; title?: string;
  locationIds: string[]; skills: string[]; desiredHours?: number; notificationPrefs: { channel: NotificationChannel };
}
export interface SeedCertification { staffId: string; locationId: string; validFrom: string; validTo: string | null }
export interface SeedAvailabilityRule { staffId: string; locationId: string; dayOfWeek: number; startLocal: string; endLocal: string }
export interface SeedAvailabilityException { staffId: string; locationId: string; date: string; type: 'unavailable' | 'available' }
export interface SeedShift {
  tempId: string; locationId: string; skill: string; headcount: number; start: string; end: string;
  status: 'draft' | 'published'; tag: string | null;
}
export interface SeedAssignment { shiftTempId: string; staffId: string; assignedByTemp: string; start: string }
export interface SeedSwapRequest {
  type: 'swap' | 'drop'; requesterId: string; assignmentKey: string; targetStaffId: string | null;
  status: string; createdAt: string; respondedAt: string | null;
}
export interface SeedNotification { userId: string; type: string; title: string; message: string; createdAt: string }
export interface SeedAuditEntry { at: string; actorId: string; actorName: string; action: string; entity: string; entityLocationTemp: string; summary: string }

export const LOCATIONS: SeedLocation[] = [
  { tempId: 'harbor', name: 'Harbor House', city: 'Boston, MA', timezone: 'America/New_York', code: 'ET' },
  { tempId: 'rooftop', name: 'The Rooftop', city: 'Miami, FL', timezone: 'America/New_York', code: 'ET' },
  { tempId: 'drift', name: 'Drift Kitchen', city: 'San Diego, CA', timezone: 'America/Los_Angeles', code: 'PT' },
  { tempId: 'saltpine', name: 'Salt & Pine', city: 'Portland, OR', timezone: 'America/Los_Angeles', code: 'PT' },
];

const STAFF_SEED: { tempId: string; name: string; locations: string[]; skills: string[]; desiredHours: number }[] = [
  { tempId: 'maria', name: 'Maria Park', locations: ['drift'], skills: ['bartender', 'server'], desiredHours: 32 },
  { tempId: 'john', name: 'John Lewis', locations: ['drift'], skills: ['bartender'], desiredHours: 36 },
  { tempId: 'sarah', name: 'Sarah Kim', locations: ['drift'], skills: ['server'], desiredHours: 28 },
  { tempId: 'jamie', name: 'Jamie Chen', locations: ['rooftop', 'drift'], skills: ['bartender'], desiredHours: 30 },
  { tempId: 'sam', name: 'Sam Rivera', locations: ['drift', 'harbor'], skills: ['server', 'host'], desiredHours: 25 },
  { tempId: 'avery', name: 'Avery Kim', locations: ['harbor'], skills: ['server', 'host'], desiredHours: 30 },
  { tempId: 'taylor', name: 'Taylor Wells', locations: ['rooftop'], skills: ['bartender', 'server'], desiredHours: 34 },
  { tempId: 'riley', name: 'Riley Santos', locations: ['drift'], skills: ['line-cook'], desiredHours: 38 },
  { tempId: 'morgan', name: 'Morgan Lee', locations: ['harbor'], skills: ['line-cook', 'host'], desiredHours: 30 },
  { tempId: 'casey', name: 'Casey Nguyen', locations: ['saltpine'], skills: ['bartender', 'line-cook'], desiredHours: 32 },
  { tempId: 'drew', name: 'Drew Patel', locations: ['saltpine'], skills: ['server'], desiredHours: 26 },
  { tempId: 'noah', name: 'Noah Bennett', locations: ['harbor'], skills: ['bartender'], desiredHours: 30 },
  { tempId: 'quinn', name: 'Quinn Ortiz', locations: ['rooftop'], skills: ['host', 'server'], desiredHours: 24 },
  { tempId: 'blair', name: 'Blair Sanchez', locations: ['saltpine'], skills: ['host'], desiredHours: 20 },
  { tempId: 'skyler', name: 'Skyler Brooks', locations: ['rooftop'], skills: ['line-cook'], desiredHours: 35 },
  { tempId: 'reese', name: 'Reese Alvarez', locations: ['harbor'], skills: ['server'], desiredHours: 30 },
];

const MANAGER_SEED = [
  { tempId: 'jordan', name: 'Jordan Miller', title: 'Operations Manager', locations: ['harbor', 'drift'] },
  { tempId: 'priya', name: 'Priya Patel', title: 'Operations Manager', locations: ['rooftop', 'saltpine'] },
];

function initials(name: string): string {
  return name.split(' ').map(part => part[0]).join('').toUpperCase();
}

const AVAILABILITY_SEED: Record<string, { locationId: string; dayOfWeek: number; startLocal: string; endLocal: string }[]> = {
  maria: [{ locationId: 'drift', dayOfWeek: 3, startLocal: '12:00', endLocal: '23:00' }, { locationId: 'drift', dayOfWeek: 4, startLocal: '12:00', endLocal: '23:00' }, { locationId: 'drift', dayOfWeek: 5, startLocal: '12:00', endLocal: '23:59' }, { locationId: 'drift', dayOfWeek: 6, startLocal: '12:00', endLocal: '23:59' }, { locationId: 'drift', dayOfWeek: 0, startLocal: '10:00', endLocal: '23:59' }],
  john: [{ locationId: 'drift', dayOfWeek: 1, startLocal: '15:00', endLocal: '23:59' }, { locationId: 'drift', dayOfWeek: 2, startLocal: '15:00', endLocal: '23:59' }, { locationId: 'drift', dayOfWeek: 5, startLocal: '15:00', endLocal: '23:59' }, { locationId: 'drift', dayOfWeek: 6, startLocal: '15:00', endLocal: '23:59' }],
  sarah: [{ locationId: 'drift', dayOfWeek: 1, startLocal: '09:00', endLocal: '17:00' }, { locationId: 'drift', dayOfWeek: 2, startLocal: '09:00', endLocal: '17:00' }, { locationId: 'drift', dayOfWeek: 3, startLocal: '09:00', endLocal: '17:00' }],
  jamie: [
    { locationId: 'rooftop', dayOfWeek: 4, startLocal: '17:00', endLocal: '23:59' },
    { locationId: 'rooftop', dayOfWeek: 5, startLocal: '17:00', endLocal: '23:59' },
    { locationId: 'drift', dayOfWeek: 5, startLocal: '17:00', endLocal: '23:59' },
    { locationId: 'drift', dayOfWeek: 6, startLocal: '17:00', endLocal: '23:59' },
  ],
  sam: [
    { locationId: 'drift', dayOfWeek: 1, startLocal: '09:00', endLocal: '17:00' },
    { locationId: 'drift', dayOfWeek: 2, startLocal: '09:00', endLocal: '17:00' },
    { locationId: 'harbor', dayOfWeek: 4, startLocal: '09:00', endLocal: '17:00' },
    { locationId: 'harbor', dayOfWeek: 5, startLocal: '09:00', endLocal: '17:00' },
  ],
  avery: [{ locationId: 'harbor', dayOfWeek: 0, startLocal: '08:00', endLocal: '16:00' }, { locationId: 'harbor', dayOfWeek: 1, startLocal: '08:00', endLocal: '16:00' }, { locationId: 'harbor', dayOfWeek: 2, startLocal: '08:00', endLocal: '16:00' }, { locationId: 'harbor', dayOfWeek: 3, startLocal: '08:00', endLocal: '16:00' }, { locationId: 'harbor', dayOfWeek: 5, startLocal: '08:00', endLocal: '23:59' }],
  taylor: [{ locationId: 'rooftop', dayOfWeek: 3, startLocal: '16:00', endLocal: '23:59' }, { locationId: 'rooftop', dayOfWeek: 4, startLocal: '16:00', endLocal: '23:59' }, { locationId: 'rooftop', dayOfWeek: 5, startLocal: '16:00', endLocal: '23:59' }, { locationId: 'rooftop', dayOfWeek: 6, startLocal: '16:00', endLocal: '23:59' }],
  riley: [{ locationId: 'drift', dayOfWeek: 1, startLocal: '10:00', endLocal: '22:00' }, { locationId: 'drift', dayOfWeek: 2, startLocal: '10:00', endLocal: '22:00' }, { locationId: 'drift', dayOfWeek: 3, startLocal: '10:00', endLocal: '22:00' }, { locationId: 'drift', dayOfWeek: 4, startLocal: '10:00', endLocal: '22:00' }, { locationId: 'drift', dayOfWeek: 5, startLocal: '10:00', endLocal: '22:00' }, { locationId: 'drift', dayOfWeek: 6, startLocal: '10:00', endLocal: '22:00' }],
  morgan: [{ locationId: 'harbor', dayOfWeek: 1, startLocal: '10:00', endLocal: '20:00' }, { locationId: 'harbor', dayOfWeek: 3, startLocal: '10:00', endLocal: '20:00' }, { locationId: 'harbor', dayOfWeek: 4, startLocal: '10:00', endLocal: '20:00' }, { locationId: 'harbor', dayOfWeek: 6, startLocal: '10:00', endLocal: '20:00' }],
  casey: [{ locationId: 'saltpine', dayOfWeek: 3, startLocal: '16:00', endLocal: '23:59' }, { locationId: 'saltpine', dayOfWeek: 4, startLocal: '16:00', endLocal: '23:59' }, { locationId: 'saltpine', dayOfWeek: 5, startLocal: '16:00', endLocal: '23:59' }, { locationId: 'saltpine', dayOfWeek: 6, startLocal: '16:00', endLocal: '23:59' }],
  drew: [{ locationId: 'saltpine', dayOfWeek: 1, startLocal: '09:00', endLocal: '17:00' }, { locationId: 'saltpine', dayOfWeek: 2, startLocal: '09:00', endLocal: '17:00' }, { locationId: 'saltpine', dayOfWeek: 0, startLocal: '09:00', endLocal: '17:00' }],
  noah: [{ locationId: 'harbor', dayOfWeek: 4, startLocal: '17:00', endLocal: '23:59' }, { locationId: 'harbor', dayOfWeek: 5, startLocal: '17:00', endLocal: '23:59' }, { locationId: 'harbor', dayOfWeek: 6, startLocal: '17:00', endLocal: '23:59' }],
  quinn: [{ locationId: 'rooftop', dayOfWeek: 1, startLocal: '11:00', endLocal: '19:00' }, { locationId: 'rooftop', dayOfWeek: 2, startLocal: '11:00', endLocal: '19:00' }, { locationId: 'rooftop', dayOfWeek: 0, startLocal: '11:00', endLocal: '19:00' }],
  blair: [{ locationId: 'saltpine', dayOfWeek: 4, startLocal: '16:00', endLocal: '22:00' }, { locationId: 'saltpine', dayOfWeek: 5, startLocal: '16:00', endLocal: '22:00' }],
  skyler: [{ locationId: 'rooftop', dayOfWeek: 3, startLocal: '11:00', endLocal: '22:00' }, { locationId: 'rooftop', dayOfWeek: 4, startLocal: '11:00', endLocal: '22:00' }, { locationId: 'rooftop', dayOfWeek: 5, startLocal: '11:00', endLocal: '22:00' }, { locationId: 'rooftop', dayOfWeek: 6, startLocal: '11:00', endLocal: '22:00' }],
  reese: [{ locationId: 'harbor', dayOfWeek: 0, startLocal: '08:00', endLocal: '16:00' }, { locationId: 'harbor', dayOfWeek: 1, startLocal: '08:00', endLocal: '16:00' }, { locationId: 'harbor', dayOfWeek: 2, startLocal: '08:00', endLocal: '16:00' }],
};

interface ShiftTemplate {
  dow: number; startLocal: string; endLocal: string; skill: string; headcount: number; assign: string[]; tag?: string;
}

const SHIFT_TEMPLATES: Record<string, ShiftTemplate[]> = {
  harbor: [
    { dow: 1, startLocal: '09:00', endLocal: '15:00', skill: 'server', headcount: 2, assign: ['avery'] },
    { dow: 1, startLocal: '10:00', endLocal: '18:00', skill: 'line-cook', headcount: 1, assign: ['morgan'] },
    { dow: 3, startLocal: '09:00', endLocal: '15:00', skill: 'server', headcount: 2, assign: ['avery'] },
    { dow: 4, startLocal: '09:00', endLocal: '17:00', skill: 'server', headcount: 1, assign: ['sam'] },
    { dow: 4, startLocal: '17:00', endLocal: '23:00', skill: 'bartender', headcount: 1, assign: ['noah'] },
    { dow: 5, startLocal: '09:00', endLocal: '17:00', skill: 'server', headcount: 1, assign: ['sam'] },
    { dow: 5, startLocal: '17:00', endLocal: '23:30', skill: 'bartender', headcount: 1, assign: ['noah'] },
    { dow: 5, startLocal: '18:00', endLocal: '23:00', skill: 'host', headcount: 1, assign: [] },
    { dow: 6, startLocal: '10:00', endLocal: '20:00', skill: 'line-cook', headcount: 1, assign: ['morgan'] },
    { dow: 6, startLocal: '17:00', endLocal: '23:30', skill: 'bartender', headcount: 1, assign: ['noah'] },
    { dow: 0, startLocal: '08:00', endLocal: '16:00', skill: 'server', headcount: 2, assign: ['avery', 'reese'] },
  ],
  rooftop: [
    { dow: 1, startLocal: '11:00', endLocal: '19:00', skill: 'host', headcount: 1, assign: ['quinn'] },
    { dow: 2, startLocal: '11:00', endLocal: '19:00', skill: 'host', headcount: 1, assign: ['quinn'] },
    { dow: 3, startLocal: '16:00', endLocal: '23:59', skill: 'bartender', headcount: 1, assign: ['taylor'] },
    { dow: 3, startLocal: '11:00', endLocal: '22:00', skill: 'line-cook', headcount: 1, assign: ['skyler'] },
    { dow: 4, startLocal: '17:00', endLocal: '23:59', skill: 'bartender', headcount: 1, assign: ['jamie'] },
    { dow: 4, startLocal: '16:00', endLocal: '23:59', skill: 'server', headcount: 1, assign: ['taylor'] },
    { dow: 5, startLocal: '18:00', endLocal: '23:59', skill: 'bartender', headcount: 1, assign: [], tag: 'conflict-demo' },
    { dow: 5, startLocal: '11:00', endLocal: '22:00', skill: 'line-cook', headcount: 1, assign: ['skyler'] },
    { dow: 6, startLocal: '16:00', endLocal: '23:59', skill: 'server', headcount: 1, assign: ['taylor'] },
    { dow: 6, startLocal: '11:00', endLocal: '22:00', skill: 'line-cook', headcount: 1, assign: ['skyler'] },
    { dow: 0, startLocal: '11:00', endLocal: '19:00', skill: 'host', headcount: 1, assign: ['quinn'] },
  ],
  drift: [
    { dow: 1, startLocal: '15:00', endLocal: '23:00', skill: 'bartender', headcount: 1, assign: ['john'] },
    { dow: 1, startLocal: '09:00', endLocal: '17:00', skill: 'server', headcount: 1, assign: ['sarah'] },
    { dow: 1, startLocal: '10:00', endLocal: '22:00', skill: 'line-cook', headcount: 1, assign: ['riley'] },
    { dow: 2, startLocal: '15:00', endLocal: '23:00', skill: 'bartender', headcount: 1, assign: ['john'] },
    { dow: 2, startLocal: '09:00', endLocal: '17:00', skill: 'server', headcount: 1, assign: ['sarah'] },
    { dow: 3, startLocal: '12:00', endLocal: '23:00', skill: 'bartender', headcount: 1, assign: ['maria'] },
    { dow: 3, startLocal: '09:00', endLocal: '17:00', skill: 'server', headcount: 1, assign: ['sarah'] },
    { dow: 4, startLocal: '12:00', endLocal: '23:00', skill: 'server', headcount: 1, assign: ['maria'] },
    { dow: 0, startLocal: '19:00', endLocal: '23:59', skill: 'bartender', headcount: 1, assign: ['maria'], tag: 'call-out-demo' },
    { dow: 5, startLocal: '17:00', endLocal: '23:59', skill: 'bartender', headcount: 1, assign: [], tag: 'conflict-demo' },
    { dow: 5, startLocal: '10:00', endLocal: '22:00', skill: 'line-cook', headcount: 1, assign: ['riley'] },
    { dow: 6, startLocal: '15:00', endLocal: '23:59', skill: 'bartender', headcount: 1, assign: ['john'] },
    { dow: 6, startLocal: '10:00', endLocal: '22:00', skill: 'line-cook', headcount: 1, assign: ['riley'] },
  ],
  saltpine: [
    { dow: 1, startLocal: '09:00', endLocal: '17:00', skill: 'server', headcount: 1, assign: ['drew'] },
    { dow: 2, startLocal: '09:00', endLocal: '17:00', skill: 'server', headcount: 1, assign: ['drew'] },
    { dow: 3, startLocal: '16:00', endLocal: '23:59', skill: 'bartender', headcount: 1, assign: ['casey'] },
    { dow: 4, startLocal: '16:00', endLocal: '23:59', skill: 'bartender', headcount: 1, assign: ['casey'] },
    { dow: 4, startLocal: '16:00', endLocal: '22:00', skill: 'host', headcount: 1, assign: ['blair'] },
    { dow: 5, startLocal: '16:00', endLocal: '23:59', skill: 'bartender', headcount: 1, assign: ['casey'] },
    { dow: 5, startLocal: '16:00', endLocal: '22:00', skill: 'host', headcount: 1, assign: ['blair'] },
    { dow: 6, startLocal: '16:00', endLocal: '23:59', skill: 'bartender', headcount: 1, assign: ['casey'] },
    { dow: 0, startLocal: '09:00', endLocal: '17:00', skill: 'server', headcount: 1, assign: ['drew'] },
  ],
};

const LOCATIONS_MANAGER: Record<string, string> = { harbor: 'jordan', drift: 'jordan', rooftop: 'priya', saltpine: 'priya' };

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export interface SeedBundle {
  weekStart: string;
  locations: SeedLocation[];
  users: SeedUser[];
  certifications: SeedCertification[];
  availabilityRules: SeedAvailabilityRule[];
  availabilityExceptions: SeedAvailabilityException[];
  shifts: SeedShift[];
  assignments: SeedAssignment[];
  swapRequests: SeedSwapRequest[];
  notifications: SeedNotification[];
  auditEntries: SeedAuditEntry[];
}

export function buildSeedData(now: Date = new Date()): SeedBundle {
  const weekStart = mondayOf(now);
  const shifts: SeedShift[] = [];
  const assignments: SeedAssignment[] = [];
  let shiftSeq = 1;

  for (const location of LOCATIONS) {
    for (const template of SHIFT_TEMPLATES[location.tempId]!) {
      const offset = template.dow === 0 ? 6 : template.dow - 1;
      const day = addDays(weekStart, offset);
      const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate();
      const [sh, sm] = template.startLocal.split(':').map(Number) as [number, number];
      const [eh, em] = template.endLocal.split(':').map(Number) as [number, number];
      const start = zonedTimeToUTC(y, m, d, sh, sm, location.timezone);
      const overnight = eh * 60 + em <= sh * 60 + sm;
      const endDay = overnight ? addDays(day, 1) : day;
      const end = zonedTimeToUTC(endDay.getUTCFullYear(), endDay.getUTCMonth() + 1, endDay.getUTCDate(), eh, em, location.timezone);

      const tempId = `sh-${shiftSeq++}`;
      shifts.push({
        tempId, locationId: location.tempId, skill: template.skill, headcount: template.headcount,
        start, end, status: 'published', tag: template.tag ?? null,
      });
      for (const staffId of template.assign) {
        assignments.push({ shiftTempId: tempId, staffId, assignedByTemp: LOCATIONS_MANAGER[location.tempId]!, start });
      }
    }
  }

  const users: SeedUser[] = [
    ...STAFF_SEED.map(s => ({
      tempId: s.tempId, name: s.name, initials: initials(s.name), email: `${s.tempId}@coastaleats.test`,
      role: 'staff' as Role, locationIds: [], skills: s.skills, desiredHours: s.desiredHours,
      notificationPrefs: { channel: 'in-app' as NotificationChannel },
    })),
    ...MANAGER_SEED.map(m => ({
      tempId: m.tempId, name: m.name, initials: initials(m.name), email: `${m.tempId}@coastaleats.test`,
      role: 'manager' as Role, title: m.title, locationIds: m.locations, skills: [],
      notificationPrefs: { channel: 'in-app+email' as NotificationChannel },
    })),
    {
      tempId: 'alex', name: 'Alex Rivera', initials: 'AR', email: 'admin@coastaleats.test', role: 'admin',
      title: 'VP of Operations', locationIds: LOCATIONS.map(l => l.tempId), skills: [],
      notificationPrefs: { channel: 'in-app+email' },
    },
  ];

  const certifications: SeedCertification[] = [];
  for (const s of STAFF_SEED) {
    for (const locationId of s.locations) certifications.push({ staffId: s.tempId, locationId, validFrom: '2024-01-01T00:00:00Z', validTo: null });
  }
  certifications.push({ staffId: 'riley', locationId: 'saltpine', validFrom: '2024-01-01T00:00:00Z', validTo: '2025-06-01T00:00:00Z' });

  const availabilityRules: SeedAvailabilityRule[] = [];
  for (const [staffId, rules] of Object.entries(AVAILABILITY_SEED)) {
    for (const r of rules) availabilityRules.push({ staffId, ...r });
  }

  const wed = addDays(weekStart, 2);
  const wedKey = `${wed.getUTCFullYear()}-${String(wed.getUTCMonth() + 1).padStart(2, '0')}-${String(wed.getUTCDate()).padStart(2, '0')}`;
  const availabilityExceptions: SeedAvailabilityException[] = [
    { staffId: 'sarah', locationId: 'drift', date: wedKey, type: 'unavailable' },
  ];

  const johnBartenderShift = shifts.find(s => s.locationId === 'drift' && s.skill === 'bartender'
    && assignments.some(a => a.shiftTempId === s.tempId && a.staffId === 'john')
    && localParts(s.start, 'America/Los_Angeles').dow === 6);

  const swapRequests: SeedSwapRequest[] = johnBartenderShift ? [{
    type: 'swap', requesterId: 'john', assignmentKey: `${johnBartenderShift.tempId}:john`, targetStaffId: 'maria',
    status: 'pending_manager', createdAt: new Date(now.getTime() - 3600e3).toISOString(),
    respondedAt: new Date(now.getTime() - 1800e3).toISOString(),
  }] : [];

  const notifications: SeedNotification[] = [
    { userId: 'jordan', type: 'swap_pending', title: 'Swap awaiting your approval', message: 'John Lewis and Maria Park agreed to swap a Drift Kitchen bartender shift.', createdAt: new Date(now.getTime() - 1800e3).toISOString() },
  ];

  const auditEntries: SeedAuditEntry[] = [
    { at: new Date(now.getTime() - 86400e3 * 3).toISOString(), actorId: 'jordan', actorName: 'Jordan Miller', action: 'publish', entity: 'schedule', entityLocationTemp: 'drift', summary: 'Published the Drift Kitchen schedule for this week.' },
  ];

  return {
    weekStart: weekStart.toISOString(), locations: LOCATIONS, users, certifications,
    availabilityRules, availabilityExceptions, shifts, assignments, swapRequests, notifications, auditEntries,
  };
}

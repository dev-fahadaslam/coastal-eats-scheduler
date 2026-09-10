const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface LocalParts {
  dow: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  minutesOfWeek: number;
}

function offsetMinutes(date: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map(p => [p.type, p.value])
  ) as Record<string, string>;
  const asUTC = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return (asUTC - date.getTime()) / 60000;
}

export function zonedTimeToUTC(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): string {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 2; i++) {
    guess = Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes(new Date(guess), timeZone) * 60000;
  }
  return new Date(guess).toISOString();
}

export function localParts(isoInstant: string | Date, timeZone: string): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, weekday: 'short', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(isoInstant)).map(p => [p.type, p.value])
  ) as Record<string, string>;
  const dow = WEEKDAYS.indexOf(parts.weekday as typeof WEEKDAYS[number]);
  const hour = +parts.hour!;
  const minute = +parts.minute!;
  return {
    dow, year: +parts.year!, month: +parts.month!, day: +parts.day!,
    hour, minute, minutesOfWeek: dow * 1440 + hour * 60 + minute,
  };
}

export function dateKeyInZone(isoInstant: string | Date, timeZone: string): string {
  const p = localParts(isoInstant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function formatTimeInZone(isoInstant: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(isoInstant));
}

export function formatDateInZone(isoInstant: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(isoInstant));
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export const WEEKDAY_NAMES: readonly string[] = WEEKDAYS;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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

export function dateKeyInZone(isoInstant: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(isoInstant)).map(p => [p.type, p.value])
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isoToLocalTime(isoInstant: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(isoInstant)).map(p => [p.type, p.value])
  ) as Record<string, string>;
  return `${parts.hour}:${parts.minute}`;
}

export function formatTimeInZone(isoInstant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(isoInstant));
}

export function formatDateInZone(isoInstant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(isoInstant));
}

export const WEEKDAY_NAMES: readonly string[] = WEEKDAYS;

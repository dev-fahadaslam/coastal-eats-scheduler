export const PUBLISH_CUTOFF_HOURS = 48;
export const MAX_PENDING_REQUESTS = 3;

export function canEditShiftClient(startIso: string, now: Date = new Date()): boolean {
  return (new Date(startIso).getTime() - now.getTime()) / 36e5 >= PUBLISH_CUTOFF_HOURS;
}

export const SKILLS = ['bartender', 'line-cook', 'server', 'host'];

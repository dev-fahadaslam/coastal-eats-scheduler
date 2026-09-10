export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

export const MANAGER_NAV: NavItem[] = [
  { path: '/overview', label: 'Overview', icon: '⌂' },
  { path: '/schedule', label: 'Schedule', icon: '▦' },
  { path: '/coverage', label: 'Coverage requests', icon: '⇄' },
  { path: '/team', label: 'Team', icon: '♧' },
  { path: '/fairness', label: 'Fairness', icon: '◔' },
  { path: '/audit', label: 'Audit log', icon: '◫' },
];

export const STAFF_NAV: NavItem[] = [
  { path: '/my-schedule', label: 'My schedule', icon: '▦' },
  { path: '/open-shifts', label: 'Open shifts', icon: '⇄' },
  { path: '/my-swaps', label: 'My swaps', icon: '↔' },
  { path: '/availability', label: 'Availability', icon: '◔' },
];

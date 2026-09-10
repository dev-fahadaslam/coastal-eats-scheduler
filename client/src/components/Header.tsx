import { useLocation } from 'react-router-dom';
import { MANAGER_NAV, STAFF_NAV } from '../routes.js';
import { useAuth } from '../context/AuthContext.js';
import { useLiveClock } from '../hooks/useLiveClock.js';
import { NotificationBell } from './NotificationBell.js';

export function Header() {
  const { user } = useAuth();
  const location = useLocation();
  const clock = useLiveClock();
  if (!user) return null;
  const nav = user.role === 'staff' ? STAFF_NAV : MANAGER_NAV;
  const title = nav.find(n => n.path === location.pathname)?.label ?? nav[0]!.label;

  return (
    <header>
      <div>
        <div className="crumb"><span className="live-dot" /> Live operations <i>•</i> <span>{clock}</span></div>
        <h1>{title}</h1>
      </div>
      <div className="header-actions">
        <NotificationBell />
      </div>
    </header>
  );
}

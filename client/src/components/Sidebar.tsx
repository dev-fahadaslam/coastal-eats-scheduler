import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useApiData } from '../hooks/useApiData.js';
import { useRealtimeRefetch } from '../hooks/useRealtimeRefetch.js';
import { api } from '../api/client.js';
import type { SwapRequest } from '../api/types.js';
import { MANAGER_NAV, STAFF_NAV } from '../routes.js';

export function Sidebar() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const isStaff = user.role === 'staff';
  const nav = isStaff ? STAFF_NAV : MANAGER_NAV;

  const { data: swaps, reload } = useApiData(
    () => (isStaff ? Promise.resolve([]) : api.get<SwapRequest[]>('/swap-requests')),
    [isStaff],
  );
  useRealtimeRefetch(reload);
  const pending = (swaps ?? []).filter(r => r.status === 'pending_manager').length;

  return (
    <aside>
      <div className="brand"><span className="brand-mark">S</span><span>ShiftSync</span></div>
      <p className="org">COASTAL EATS · OPERATIONS</p>
      <nav>
        {nav.map(item => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon">{item.icon}</span>{item.label}
            {item.path === '/coverage' && pending > 0 ? <b>{pending}</b> : null}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-note">
        <span className="pulse" />
        <div><strong>System healthy</strong><small>Live via WebSocket</small></div>
      </div>
      <div className="profile">
        <div className="avatar">{user.initials}</div>
        <div>
          <strong>{user.name}</strong>
          <small>{user.title ?? user.role[0]!.toUpperCase() + user.role.slice(1)}</small>
        </div>
        <button className="more" title="Sign out" onClick={logout}>⏻</button>
      </div>
    </aside>
  );
}

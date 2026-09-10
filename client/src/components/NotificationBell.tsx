import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../context/NotificationContext.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/client.js';
import type { NotificationChannel } from '../api/types.js';

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<NotificationChannel>(user?.notificationPrefs.channel ?? 'in-app');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, []);

  async function changeChannel(next: NotificationChannel) {
    setChannel(next);
    if (user) await api.patch(`/users/${user.id}/notification-prefs`, { channel: next });
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button className="icon-button" onClick={() => setOpen(o => !o)}>
        ♢{unreadCount > 0 ? <i>{unreadCount}</i> : null}
      </button>
      <div className={`notif-panel ${open ? 'open' : ''}`}>
        <div className="notif-head">
          <strong>Notifications</strong>
          {notifications.length > 0 && <button className="link" onClick={markAllRead}>Mark all read</button>}
        </div>
        {notifications.length === 0
          ? <p className="empty">You&rsquo;re all caught up.</p>
          : notifications.slice(0, 20).map(n => (
            <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => markRead(n.id)}>
              <strong>{n.title}{n.emailSimulated ? <span className="badge"> ✉ emailed</span> : null}</strong>
              <p>{n.message}</p>
              <small>{new Date(n.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>
            </div>
          ))}
        <div className="notif-prefs">
          <label>
            Delivery preference
            <select value={channel} onChange={e => changeChannel(e.target.value as NotificationChannel)}>
              <option value="in-app">In-app only</option>
              <option value="in-app+email">In-app + email (simulated)</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

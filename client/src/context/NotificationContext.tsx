import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.js';
import { useSocket } from './SocketContext.js';
import { useToast } from './ToastContext.js';
import type { Notification } from '../api/types.js';

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socket = useSocket();
  const showToast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    api.get<Notification[]>('/notifications').then(setNotifications).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!socket) return;
    const onNotification = (n: Notification) => {
      setNotifications(prev => [n, ...prev]);
      showToast(n.message, 'info');
    };
    socket.on('notification', onNotification);
    return () => { socket.off('notification', onNotification); };
  }, [socket, showToast]);

  function markRead(id: string) {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    api.post(`/notifications/${id}/read`).catch(() => {});
  }
  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    api.post('/notifications/read-all').catch(() => {});
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

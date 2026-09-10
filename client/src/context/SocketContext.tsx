import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext.js';
import { getToken } from '../api/client.js';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      return;
    }
    const token = getToken();
    const instance = io({ auth: { token } });
    setSocket(instance);
    return () => {
      instance.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}

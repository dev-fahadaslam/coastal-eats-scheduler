import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext.js';

export function useRealtimeRefetch(onUpdate: () => void): void {
  const socket = useSocket();
  const ref = useRef(onUpdate);
  ref.current = onUpdate;

  useEffect(() => {
    if (!socket) return;
    const handler = () => ref.current();
    socket.on('shift-update', handler);
    return () => {
      socket.off('shift-update', handler);
    };
  }, [socket]);
}

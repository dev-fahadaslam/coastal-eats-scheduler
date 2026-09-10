import type { Server } from 'socket.io';

let ioRef: Server | null = null;

export function setIO(io: Server): void {
  ioRef = io;
}

export function emitToLocation(locationId: string, event: string, payload: unknown): void {
  ioRef?.emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  ioRef?.to(`user:${userId}`).emit(event, payload);
}

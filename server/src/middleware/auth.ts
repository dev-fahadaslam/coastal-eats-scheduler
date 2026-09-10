import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import User, { type IUser, type Role } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-not-for-production';

export interface AuthedRequest extends Request {
  user?: IUser;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): { sub: string } {
  return jwt.verify(token, JWT_SECRET) as { sub: string };
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing auth token.' });
    return;
  }
  try {
    const payload = verifyToken(header.slice(7));
    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'User no longer exists.' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Not authorized for this action.' });
      return;
    }
    next();
  };
}

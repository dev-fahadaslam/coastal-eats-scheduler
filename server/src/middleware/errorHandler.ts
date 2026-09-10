import type { NextFunction, Request, Response } from 'express';
import { ConstraintError, ConflictError, NotFoundError } from '../services/errors.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ConstraintError) {
    res.status(400).json({ error: err.message, issues: err.issues, warnings: err.warnings });
    return;
  }
  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
}

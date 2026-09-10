import type { Evaluation } from '../domain/types.js';

export class ConstraintError extends Error {
  issues: string[];
  warnings: string[];
  constructor(message: string, detail?: Partial<Evaluation>) {
    super(message);
    this.name = 'ConstraintError';
    this.issues = detail?.issues ?? [message];
    this.warnings = detail?.warnings ?? [];
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

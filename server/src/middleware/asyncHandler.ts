import type { NextFunction, Request, Response } from 'express';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function ah(fn: Handler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

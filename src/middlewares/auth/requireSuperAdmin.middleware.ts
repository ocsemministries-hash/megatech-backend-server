import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Requires req.admin.isSuperAdmin. Must run after authenticateAdmin. */
export const requireSuperAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.admin) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  if (!req.admin.isSuperAdmin) {
    res.status(403).json({ success: false, error: 'Forbidden: super admin required' });
    return;
  }
  next();
};

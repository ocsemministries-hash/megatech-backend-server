import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { permissionKey } from '@/lib/security/rbac.constants';
import type { RbacAction, RbacResource } from '@/lib/security/rbac.constants';

/**
 * Route guard for admin endpoints. Checks the authenticated admin (set by
 * authenticateAdmin) holds `<resource>:<action>`. Super admins bypass the check.
 */
export const rbac =
  (resource: RbacResource, action: RbacAction): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const admin = req.admin;
    if (!admin) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    if (admin.isSuperAdmin) {
      next();
      return;
    }
    if (admin.permissions.includes(permissionKey(resource, action))) {
      next();
      return;
    }
    res.status(403).json({ success: false, error: 'Forbidden: insufficient permissions' });
  };

/** Passes when the admin holds at least one of the given permissions. Super admins bypass, as with rbac(). */
export const rbacAny =
  (...pairs: Array<[RbacResource, RbacAction]>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const admin = req.admin;
    if (!admin) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    if (admin.isSuperAdmin) {
      next();
      return;
    }
    const granted = pairs.some(([resource, action]) => admin.permissions.includes(permissionKey(resource, action)));
    if (granted) {
      next();
      return;
    }
    res.status(403).json({ success: false, error: 'Forbidden: insufficient permissions' });
  };

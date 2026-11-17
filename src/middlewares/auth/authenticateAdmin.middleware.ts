import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '@/utils/jwt';
import { ACCESS_COOKIE, ADMIN_ACCESS_COOKIE } from '@/utils/cookies';
import type { AdminPrincipal } from '@/types/auth';

/** Sets req.admin from the httpOnly access cookie (present on admin routes only). */
export const authenticateAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const token =
    (req.cookies?.[ADMIN_ACCESS_COOKIE] as string | undefined) ??
    (req.cookies?.[ACCESS_COOKIE] as string | undefined) ?? // legacy pair, one release
    extractBearer(req);

  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  req.admin = {
    id: payload.sub,
    email: payload.email,
    roleId: null,
    firstName: '',
    lastName: '',
    roleName: payload.role,
    isSuperAdmin: payload.isSuperAdmin,
    permissions: payload.permissions,
  } satisfies AdminPrincipal;

  next();
};

const extractBearer = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
};

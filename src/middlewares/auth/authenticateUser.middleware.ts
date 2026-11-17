import type { NextFunction, Request, Response } from 'express';
import { verifyUserAccessToken } from '@/utils/jwt';
import { USER_ACCESS_COOKIE } from '@/utils/cookies';
import type { UserPrincipal } from '@/types/auth';

/** Sets req.user from the httpOnly partner access cookie (public-user routes only). */
export const authenticateUser = (req: Request, res: Response, next: NextFunction): void => {
  const token = (req.cookies?.[USER_ACCESS_COOKIE] as string | undefined) ?? extractBearer(req);

  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const payload = verifyUserAccessToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  req.user = {
    id: payload.sub,
    email: payload.email,
    firstName: '',
    lastName: '',
  } satisfies UserPrincipal;

  next();
};

const extractBearer = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
};

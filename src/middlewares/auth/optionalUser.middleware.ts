import type { NextFunction, Request, Response } from 'express';
import { verifyUserAccessToken } from '@/utils/jwt';
import { USER_ACCESS_COOKIE } from '@/utils/cookies';

/**
 * Attaches req.user when a valid partner-user credential is present, and
 * always continues otherwise. Public submission endpoints use this so
 * anonymous visitors (source PUBLIC) and signed-in users (source USER)
 * share one route.
 */
export const optionalUser = (req: Request, _res: Response, next: NextFunction): void => {
  const token = (req.cookies?.[USER_ACCESS_COOKIE] as string | undefined) ?? extractBearer(req);
  if (!token) {
    next();
    return;
  }

  const payload = verifyUserAccessToken(token);
  if (payload) {
    req.user = {
      id: payload.sub,
      email: payload.email,
      firstName: '',
      lastName: '',
    };
  }
  next();
};

const extractBearer = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
};

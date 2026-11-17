import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { ENV } from '@/config/env';
import type { AdminPrincipal, UserPrincipal } from '@/types/auth';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
};

export type UserAccessTokenPayload = {
  sub: string;
  email: string;
};

const ADMIN_ISSUER = 'megatech-admin';
const USER_ISSUER = 'megatech-user';

const sign = (
  payload: AccessTokenPayload | UserAccessTokenPayload,
  secret: string,
  expiresIn: string | number,
  issuer: string,
): string => {
  const options: SignOptions = {
    algorithm: 'HS256',
    issuer,
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, secret, options);
};

export const signAccessToken = (principal: AdminPrincipal): string =>
  sign(
    {
      sub: principal.id,
      email: principal.email,
      role: principal.roleName,
      isSuperAdmin: principal.isSuperAdmin,
      permissions: principal.permissions,
    },
    ENV.JWT_ACCESS_SECRET,
    ENV.ACCESS_TOKEN_TTL,
    ADMIN_ISSUER,
  );

export const verifyAccessToken = (token: string): AccessTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET, { issuer: ADMIN_ISSUER });
    return decoded as AccessTokenPayload;
  } catch {
    return null;
  }
};

export const signUserAccessToken = (principal: UserPrincipal): string =>
  sign(
    { sub: principal.id, email: principal.email },
    ENV.JWT_ACCESS_SECRET,
    ENV.ACCESS_TOKEN_TTL,
    USER_ISSUER,
  );

export const verifyUserAccessToken = (token: string): UserAccessTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET, { issuer: USER_ISSUER });
    return decoded as UserAccessTokenPayload;
  } catch {
    return null;
  }
};

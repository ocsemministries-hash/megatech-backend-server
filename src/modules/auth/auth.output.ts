import type { AdminStatus, RoleName } from '@prisma/client';
import type { AuthSession, OtpIssuedResult } from './auth.types';
import type { AdminWithPermissions } from '@/lib/security/principal';

export interface AdminPublicDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: AdminStatus;
  isSuperAdmin: boolean;
  roleName: RoleName | null;
  permissions: string[];
  /** True when a Google identity is linked (the Google subject id itself is never exposed). */
  hasGoogle: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Response shaping for admin identity exposed through auth endpoints. */
export const toAdminPublicDto = (admin: AdminWithPermissions): AdminPublicDto => ({
  id: admin.id,
  firstName: admin.firstName,
  lastName: admin.lastName,
  email: admin.email,
  phone: admin.phone,
  status: admin.status,
  isSuperAdmin: admin.isSuperAdmin,
  roleName: admin.roleName,
  permissions: admin.permissions,
  hasGoogle: Boolean(admin.googleSub),
  lastLoginAt: admin.lastLoginAt ? admin.lastLoginAt.toISOString() : null,
  createdAt: admin.createdAt.toISOString(),
});

export interface SessionDto {
  admin: AdminPublicDto;
}

/**
 * Session shape sent in response bodies. Tokens travel exclusively via
 * httpOnly cookies — never in JS-accessible bodies or storage.
 */
export const toSessionDto = (session: AuthSession): SessionDto => ({
  admin: toAdminPublicDto(session.admin),
});

export const toMessageDto = (message: string): { message: string } => ({ message });

export const toOtpIssuedDto = (result: OtpIssuedResult): { message: string; expiresInMinutes: number } => ({
  message: result.otpSent ? 'Verification code sent' : 'Verification code generated (email disabled)',
  expiresInMinutes: result.expiresInMinutes,
});

/**
 * Generic acknowledgement for a password-reset request. The wording never
 * depends on whether the account exists (anti-enumeration).
 */
export const toPasswordResetRequestedDto = (expiresInMinutes: number): { message: string; expiresInMinutes: number } => ({
  message: 'If an account exists for that email, a reset code has been sent',
  expiresInMinutes,
});

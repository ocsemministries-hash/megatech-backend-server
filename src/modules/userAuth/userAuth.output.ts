import type { User, UserStatus } from '@prisma/client';

export interface UserPublicDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
  hasPassword: boolean;
  hasGoogle: boolean;
  loginOtpEnabled: boolean;
  createdAt: string;
}

/** Response shaping for partner identity exposed through user-auth endpoints. */
export const toUserPublicDto = (user: User): UserPublicDto => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  status: user.status,
  hasPassword: Boolean(user.passwordHash),
  hasGoogle: Boolean(user.googleSub),
  loginOtpEnabled: user.loginOtpEnabled,
  createdAt: user.createdAt.toISOString(),
});

export const toMessageDto = (message: string): { message: string } => ({ message });

export const toOtpIssuedDto = (result: { otpSent: boolean; expiresInMinutes: number }): { message: string; expiresInMinutes: number } => ({
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

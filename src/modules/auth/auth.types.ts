import type { AdminStatus, RoleName, TokenType } from '@prisma/client';
import type { AdminWithPermissions } from '@/lib/security/principal';

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface VerifyEmailInput {
  email: string;
  otp: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface VerifyOtpInput {
  email: string;
  otp: string;
}

export type OtpPurpose = 'verify_email' | 'login';

export interface ResendOtpInput {
  email: string;
  purpose: OtpPurpose;
}

export interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

/** Self-service profile edit (email, role and status are not editable here). */
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
}

/** Request metadata recorded on session audit rows. */
export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  email: string;
  otp: string;
  newPassword: string;
}

export interface GoogleSignInInput {
  idToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface OtpIssuedResult {
  otpSent: boolean;
  expiresInMinutes: number;
}

export interface AuthSession {
  admin: AdminWithPermissions;
  accessToken: string;
  refreshToken: string;
}

export type { AdminStatus, RoleName, TokenType };

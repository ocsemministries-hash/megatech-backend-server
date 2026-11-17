import type { User } from '@prisma/client';

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

export interface OtpIssuedResult {
  otpSent: boolean;
  expiresInMinutes: number;
}

export interface UserSession {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type PasswordLoginResult =
  | ({ requiresOtp: true } & OtpIssuedResult)
  | { requiresOtp: false; session: UserSession };

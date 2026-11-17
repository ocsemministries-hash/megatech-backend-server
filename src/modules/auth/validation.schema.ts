import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('A valid email is required')
  .max(255);

const otpSchema = z.string().trim().regex(/^\d{6}$/, 'OTP must be a 6 digit code');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: emailSchema,
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

export const resendOtpSchema = z.object({
  email: emailSchema,
  purpose: z.enum(['verify_email', 'login']),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required').max(128),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
});

export const googleSignInSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required').max(8192),
});

/** Self-service profile edit: strict (email/role/status are not editable here), at least one field. */
export const updateMeSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(100).optional(),
    lastName: z.string().trim().min(1, 'Last name is required').max(100).optional(),
    phone: z.string().trim().max(50).optional().nullable(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export type RegisterDto = z.infer<typeof registerSchema>;
export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;
export type ResendOtpDto = z.infer<typeof resendOtpSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type GoogleSignInDto = z.infer<typeof googleSignInSchema>;
export type UpdateMeDto = z.infer<typeof updateMeSchema>;

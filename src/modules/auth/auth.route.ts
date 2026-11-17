import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '@/middlewares/validate';
import { authenticateAdmin } from '@/middlewares/auth/authenticateAdmin.middleware';
import { loginLimiter, otpLimiter, refreshLimiter } from '@/middlewares/rateLimit';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  googleSignInSchema,
  loginSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  updateMeSchema,
  verifyEmailSchema,
  verifyOtpSchema,
} from './validation.schema';

export const authRouter = (): Router => {
  const router = Router();
  const controller = new AuthController();

  router.post('/register', validate(registerSchema), controller.register);
  router.post('/verify-email', otpLimiter, validate(verifyEmailSchema), controller.verifyEmail);
  router.post('/resend-otp', otpLimiter, validate(resendOtpSchema), controller.resendOtp);
  router.post('/login', loginLimiter, validate(loginSchema), controller.login);
  router.post('/otp', otpLimiter, validate(verifyOtpSchema), controller.verifyOtp);
  router.post('/google', loginLimiter, validate(googleSignInSchema), controller.googleSignIn);
  router.post('/google/link', authenticateAdmin, validate(googleSignInSchema), controller.linkGoogle);
  router.delete('/google/link', authenticateAdmin, controller.unlinkGoogle);
  router.post('/refresh', refreshLimiter, controller.refresh);
  // Public: the refresh cookie is the credential (works after the access token expired).
  router.post('/logout', refreshLimiter, controller.logout);
  router.get('/me', authenticateAdmin, controller.me);
  router.patch('/me', authenticateAdmin, validate(updateMeSchema), controller.updateMe);
  router.post('/change-password', authenticateAdmin, validate(changePasswordSchema), controller.changePassword);
  // Public password recovery (the emailed OTP is the credential).
  router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
  router.post('/reset-password', otpLimiter, validate(resetPasswordSchema), controller.resetPassword);

  return router;
};

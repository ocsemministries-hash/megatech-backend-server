import { Router } from 'express';
import { UserAuthController } from './userAuth.controller';
import { validate } from '@/middlewares/validate';
import { authenticateUser } from '@/middlewares/auth/authenticateUser.middleware';
import { loginLimiter, otpLimiter, refreshLimiter } from '@/middlewares/rateLimit';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  googleSignInSchema,
  loginSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyOtpSchema,
} from './validation.schema';

export const userAuthRouter = (): Router => {
  const router = Router();
  const controller = new UserAuthController();

  router.post('/register', validate(registerSchema), controller.register);
  router.post('/verify-email', otpLimiter, validate(verifyEmailSchema), controller.verifyEmail);
  router.post('/resend-otp', otpLimiter, validate(resendOtpSchema), controller.resendOtp);
  router.post('/login', loginLimiter, validate(loginSchema), controller.login);
  router.post('/otp', otpLimiter, validate(verifyOtpSchema), controller.verifyOtp);
  router.post('/google', loginLimiter, validate(googleSignInSchema), controller.googleSignIn);
  router.post('/refresh', refreshLimiter, controller.refresh);
  router.post('/logout', authenticateUser, controller.logout);
  router.get('/me', authenticateUser, controller.me);
  router.post('/change-password', authenticateUser, validate(changePasswordSchema), controller.changePassword);
  // Public password recovery (the emailed OTP is the credential).
  router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
  router.post('/reset-password', otpLimiter, validate(resetPasswordSchema), controller.resetPassword);

  return router;
};

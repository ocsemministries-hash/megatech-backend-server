import rateLimit from 'express-rate-limit';

/**
 * Tight per-route limiters for credential-bearing auth endpoints.
 * Keyed by IP (behind `trust proxy`) — the usecases additionally key OTP
 * attempts per account, so these are a second, outer layer.
 */
export const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later.' },
});

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later.' },
});

export const refreshLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later.' },
});

/**
 * Outer anti-spam layer for unauthenticated public submissions
 * (prayer requests, testimonies). Keyed by IP behind `trust proxy`.
 */
export const submissionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many submissions, please try again later.' },
});

import dotenv from 'dotenv';
import { logger } from '@/utils/logger';
dotenv.config();

const parseList = (raw?: string): string[] =>
  raw
    ? raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const parseCorsOrigins = (rawOrigins?: string): string[] => {
  const parsed = parseList(rawOrigins);
  return parsed.length > 0 ? parsed : ['http://localhost:3000', 'http://localhost:5173'];
};

const isProduction = process.env.NODE_ENV === 'production';

const DELIVERY_MODES = ['REST', 'SMTP', 'HYBRID_FALLBACK'] as const;
export type EmailDeliveryModeEnv = (typeof DELIVERY_MODES)[number];

/** Validates EMAIL_DELIVERY_MODE, defaulting to REST-with-SMTP-fallback. */
const parseDeliveryMode = (raw?: string): EmailDeliveryModeEnv => {
  const value = (raw ?? '').trim().toUpperCase();
  if (!value) return 'HYBRID_FALLBACK';

  const match = DELIVERY_MODES.find((mode) => mode === value);
  if (match) return match;

  logger.warn(
    `[env] EMAIL_DELIVERY_MODE="${raw}" is not one of ${DELIVERY_MODES.join(' | ')} — falling back to HYBRID_FALLBACK`
  );
  return 'HYBRID_FALLBACK';
};

export const ENV = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: parseCorsOrigins(process.env.CORS_ORIGIN),
  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',
  DIRECT_URL: process.env.DIRECT_URL || '',
  // Boot-time `prisma migrate deploy` budget (CLI start-up alone can take ~10s on Windows; remote DBs add latency).
  PRISMA_CLI_TIMEOUT_MS: Number(process.env.PRISMA_CLI_TIMEOUT_MS) || 120_000,
  // Admin bootstrap gate
  ADMIN_MAILS: parseList(process.env.ADMIN_MAILS),
  // Auth / JWT
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || '15m',
  REFRESH_TOKEN_TTL_DAYS: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7,
  OTP_TTL_MINUTES: Number(process.env.OTP_TTL_MINUTES) || 10,
  OTP_MAX_ATTEMPTS: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
  INVITE_TTL_HOURS: Number(process.env.INVITE_TTL_HOURS) || 72,
  // Cookies
  COOKIE_SECURE: isProduction ? process.env.COOKIE_SECURE !== 'false' : process.env.COOKIE_SECURE === 'true',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  // Frontends
  ADMIN_WEB_URL: process.env.ADMIN_WEB_URL || 'http://localhost:5173',
  FRONTEND_WEB_URL: process.env.FRONTEND_WEB_URL || 'http://localhost:3000',
  // Public base URL of this API — used for links embedded in emails (e.g. one-click unsubscribe).
  API_PUBLIC_URL: process.env.API_PUBLIC_URL || `http://localhost:${Number(process.env.PORT) || 5000}`,
  // Google sign-in (GIS ID tokens verified server-side)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  // Core mailing system (shared notification infrastructure)
  // SMTP
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || 'Megatech <no-reply@megatech.org>',
  // Mail delivery channel: REST (primary) with automatic SMTP fallback.
  EMAIL_DELIVERY_MODE: parseDeliveryMode(process.env.EMAIL_DELIVERY_MODE),
  // REST transport — Mailtrap Email Sending API is the first REST platform.
  MAILTRAP_API_TOKEN: process.env.MAILTRAP_API_TOKEN || '',
  MAILTRAP_API_URL: process.env.MAILTRAP_API_URL || 'https://send.api.mailtrap.io/api/send',
  EMAIL_REST_TIMEOUT_MS: Number(process.env.EMAIL_REST_TIMEOUT_MS) || 10_000,
  // Mailtrap's edge protection blocks requests without a normal User-Agent.
  EMAIL_REST_USER_AGENT: process.env.EMAIL_REST_USER_AGENT || 'megatech-backend/1.0 (+https://megatech.org)',
  // Cloudinary (signed direct uploads; the API never receives file bytes)
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  CLOUDINARY_UPLOAD_FOLDER: process.env.CLOUDINARY_UPLOAD_FOLDER || 'megatech/media',
  // Paystack secret is server-only; never expose it to the browser.
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
};

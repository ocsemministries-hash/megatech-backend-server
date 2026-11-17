import { beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.ADMIN_MAILS = 'root@megatech.org,admin@megatech.org';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.ACCESS_TOKEN_TTL = '15m';
process.env.REFRESH_TOKEN_TTL_DAYS = '7';
process.env.OTP_TTL_MINUTES = '10';
process.env.OTP_MAX_ATTEMPTS = '5';
process.env.INVITE_TTL_HOURS = '72';
process.env.ADMIN_WEB_URL = 'http://localhost:2384';

// Boot the same background listeners the server starts with (src/app.ts), so
// unit tests exercise event-driven side effects exactly as production does.
// Imported dynamically so the env vars above are set before ENV is evaluated.
beforeAll(async () => {
  const { initializeEventListeners } = await import('@/lib/events');
  initializeEventListeners();
});

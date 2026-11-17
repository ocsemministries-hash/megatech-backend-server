import cron from 'node-cron';
import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { purgeExpiredVerificationTokens } from './functions/purgeExpiredVerificationTokens.job';

/**
 * Starts the cron scheduler. Called once from server.ts (never during tests).
 */
export const startCronJobs = (): void => {
  if (ENV.NODE_ENV === 'test') return;

  // Every hour at minute 17 — purge expired/consumed verification tokens.
  cron.schedule('17 * * * *', () => {
    void purgeExpiredVerificationTokens().catch((error) => logger.error('[cron] purge job failed', error));
  });

  logger.info('[cron] scheduler started');
};

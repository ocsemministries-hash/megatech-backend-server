import { logger } from '@/utils/logger';
import { VerificationTokenRepository } from '@/lib/dal/repositories/verificationToken/verificationToken.repository';

/**
 * Deletes expired verification tokens and consumed tokens beyond the
 * retention window. Exported pure-ish for unit testing (clock injected).
 */
export const purgeExpiredVerificationTokens = async (
  now: Date = new Date(),
  repo: VerificationTokenRepository = new VerificationTokenRepository()
): Promise<number> => {
  const count = await repo.purge(now);
  if (count > 0) logger.info(`[cron] purged ${count} expired/consumed verification tokens`);
  return count;
};

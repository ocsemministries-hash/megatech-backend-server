import { runDeployTasks } from '@/lib/db/deploy.js';
import { prisma } from '@/lib/dal/base/prisma.client.js';
import { logger } from '@/utils/logger.js';

/**
 * Standalone database bootstrap entry point.
 *
 * Compiled to `dist/deploy.js`, this lets CI/CD pipelines run migrations and
 * the additive permission sync as a separate release step (with `DEPLOY_MIGRATE` /
 * `DEPLOY_SYNC` already disabled on the server boot path, if desired):
 *
 *   npm run db:deploy           # source, via tsx
 *   node dist/deploy.js         # compiled, in production images
 *
 * Exits 0 on success, 1 on failure, so pipelines fail fast.
 */
const main = async (): Promise<void> => {
  await runDeployTasks();
  await prisma.$disconnect();
  process.exit(0);
};

main().catch(async (error) => {
  logger.error('[deploy] Database bootstrap failed:', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

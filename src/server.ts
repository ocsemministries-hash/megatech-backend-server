import app from './app.js';
import { ENV } from '@/config/env.js';
import { logger } from '@/utils/logger.js';
import { startCronJobs } from '@/lib/cron/index.js';
import { runDeployTasks } from '@/lib/db/deploy.js';

const start = async (): Promise<void> => {
  // Boot-time database bootstrap: applies pending migrations and the
  // additive permission sync before the server accepts traffic. Opt out per step
  // with DEPLOY_MIGRATE=false / DEPLOY_SYNC=false (e.g. when migrations are
  // applied by a separate release pipeline via `npm run db:deploy`).
  await runDeployTasks();

  const server = app.listen(ENV.PORT, () => {
    logger.info(`Server running in ${ENV.NODE_ENV} mode on port ${ENV.PORT}`);
  });

  startCronJobs();

  // Graceful Shutdown
  const shutdown = () => {
    logger.info('Received kill signal, shutting down gracefully...');
    server.close(() => {
      logger.info('Closed remaining connections.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
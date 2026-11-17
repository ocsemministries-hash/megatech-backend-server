import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ENV } from '@/config/env.js';
import { logger } from '@/utils/logger.js';

/**
 * Deploy-time database bootstrap.
 *
 * Runs the steps a fresh environment needs before the server can serve
 * traffic, and is safe to run on every boot:
 *
 *   1. `prisma migrate deploy` — applies every pending migration. This is the
 *      non-interactive variant, so it is the right choice for deploys; it is a
 *      fast no-op (one query against `_prisma_migrations`) when up to date.
 *   2. The role sync (`syncRoles`). Create-only: any missing system role
 *      (SUPER_ADMIN, ADMIN, EDITOR, VIEWER) is created; existing roles are
 *      never modified and no grants are added (those stay in the seed).
 *   3. The permission sync (`syncPermissions`). Additive-only: every
 *      `resource:action` key in `rbac.constants.ts` that is missing from the
 *      DB gets inserted; existing rows and role assignments are never
 *      touched. Add a resource to `RBAC_RESOURCES` and it lands in the DB on
 *      the next boot.
 *
 * Individual steps can be disabled with env vars, e.g. when migrations are
 * applied by a CI pipeline or a separate release job:
 *
 *   DEPLOY_MIGRATE=false  skip `prisma migrate deploy` (default: on)
 *   DEPLOY_SYNC=false     skip the role + permission sync (default: on)
 *   PRISMA_CLI_TIMEOUT_MS how long `prisma migrate deploy` may run (default: 120000)
 */
export interface DeployOptions {
  runMigrations: boolean;
  runSync: boolean;
}

/** Flags are opt-out: anything other than a falsy word (or empty) keeps the step on. */
const isFlagEnabled = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === '') return fallback;
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
};

export const resolveDeployOptions = (env: NodeJS.ProcessEnv = process.env): DeployOptions => ({
  runMigrations: isFlagEnabled(env.DEPLOY_MIGRATE, true),
  // DEPLOY_SEED is the legacy name from the old seed step; DEPLOY_SYNC wins when set.
  runSync: isFlagEnabled(env.DEPLOY_SYNC ?? env.DEPLOY_SEED, true),
});

/**
 * Runs the Prisma CLI bundled in this package's node_modules. `npm start` (and
 * any container build that runs the package scripts) guarantees the working
 * directory is the package root, so resolving the CLI relative to `cwd` avoids
 * any dependency on global installs.
 *
 * stdin is NOT inherited: `migrate deploy` never prompts, and under
 * `npm run dev` the console stdin is held by the file watcher (it listens for
 * "rs"). A child sharing that handle hangs on Windows until the timeout.
 */
const runPrismaCli = (args: string[], timeoutMs: number = ENV.PRISMA_CLI_TIMEOUT_MS): Promise<void> =>
  new Promise((resolve, reject) => {
    const cliEntry = path.resolve(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
    const child = spawn(process.execPath, [cliEntry, ...args], {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, DATABASE_URL: ENV.DATABASE_URL, DIRECT_URL: ENV.DIRECT_URL },
    });
    const timeout = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already exited */
      }
      reject(
        new Error(
          `Prisma CLI timed out after ${Math.round(timeoutMs / 1000)}s: prisma ${args.join(' ')} ` +
            '(raise PRISMA_CLI_TIMEOUT_MS for slow/remote databases, or set DEPLOY_MIGRATE=false and run `npm run db:deploy`)'
        )
      );
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`prisma ${args.join(' ')} exited with code ${code}`));
    });
  });

type SyncModule = typeof import('@/lib/security/rbac.sync.js');

/**
 * The sync lives under `src/` and is compiled into `dist/` by `npm run build`.
 * The compiled copy is preferred so plain `node dist/deploy.js` works without a
 * `tsx` runtime; when `dist/` has not been built (e.g. `npm run db:deploy`
 * during development), the `@/` alias import is used, which `tsx` understands.
 */
const importSyncModule = async (): Promise<SyncModule> => {
  const compiled = path.resolve(process.cwd(), 'dist', 'lib', 'security', 'rbac.sync.js');
  const loadCompiled = (): Promise<SyncModule> => import(pathToFileURL(compiled).href);

  // In production prefer the compiled copy. Otherwise prefer the source module
  // (fresh constants even before a rebuild); if the `@/` alias cannot resolve
  // (plain node, no tsx), fall back to the compiled copy when it exists.
  if (ENV.NODE_ENV === 'production' && existsSync(compiled)) {
    return loadCompiled();
  }
  try {
    return await import('@/lib/security/rbac.sync.js');
  } catch {
    if (existsSync(compiled)) return loadCompiled();
    throw new Error('Permission sync module not found — run `npm run build` or start via tsx.');
  }
};

/** Runs the enabled deploy steps in order; throws on the first failure. */
export const runDeployTasks = async (
  options: DeployOptions = resolveDeployOptions()
): Promise<void> => {
  logger.debug(`[deploy] Options resolved: ${JSON.stringify(options)}`);
  logger.debug(`[deploy] NODE_ENV=${ENV.NODE_ENV}`);
  if (options.runMigrations) {
    const start = Date.now();
    logger.info('[deploy] Applying pending migrations (prisma migrate deploy)...');
    logger.debug('[deploy] DATABASE_URL host is set: ' + (ENV.DATABASE_URL ? 'yes' : 'no'));
    await runPrismaCli(['migrate', 'deploy']);
    logger.info(`[deploy] Migrations up to date in ${Date.now() - start}ms.`);
  } else {
    logger.info('[deploy] Skipping migrations (DEPLOY_MIGRATE=false).');
  }

  if (options.runSync) {
    const sync = await importSyncModule();

    logger.info('[deploy] Syncing system roles (create-only)...');
    const roleStart = Date.now();
    const roles = await sync.syncRoles();
    logger.info(
      `[deploy] Role sync complete in ${Date.now() - roleStart}ms: ${roles.total} total, ${roles.added} added, ${roles.skipped} already present.`
    );

    logger.info('[deploy] Syncing permissions (additive-only)...');
    logger.debug('[deploy] Starting permission sync...');
    const syncStart = Date.now();
    const result = await sync.syncPermissions();
    logger.info(
      `[deploy] Permission sync complete in ${Date.now() - syncStart}ms: ${result.total} total, ${result.added} added, ${result.skipped} already present.`
    );
  } else {
    logger.info('[deploy] Skipping role + permission sync (DEPLOY_SYNC=false).');
  }
};

import { describe, expect, it } from 'vitest';
import { resolveDeployOptions } from '@/lib/db/deploy';

describe('resolveDeployOptions', () => {
  const base = { DATABASE_URL: 'postgresql://test' };

  it('enables both steps by default', () => {
    expect(resolveDeployOptions(base)).toEqual({ runMigrations: true, runSync: true });
  });

  it('disables a step for explicit falsy values', () => {
    expect(resolveDeployOptions({ ...base, DEPLOY_MIGRATE: 'false' })).toEqual({
      runMigrations: false,
      runSync: true,
    });
    expect(resolveDeployOptions({ ...base, DEPLOY_SYNC: '0' })).toEqual({
      runMigrations: true,
      runSync: false,
    });
    expect(resolveDeployOptions({ ...base, DEPLOY_SYNC: 'off' }).runSync).toBe(false);
  });

  it('honours the legacy DEPLOY_SEED flag when DEPLOY_SYNC is unset', () => {
    expect(resolveDeployOptions({ ...base, DEPLOY_SEED: 'false' }).runSync).toBe(false);
    expect(resolveDeployOptions({ ...base, DEPLOY_SEED: '0' }).runSync).toBe(false);
  });

  it('treats any other value as enabled, including junk and whitespace', () => {
    expect(resolveDeployOptions({ ...base, DEPLOY_MIGRATE: 'true', DEPLOY_SYNC: 'yes' })).toEqual({
      runMigrations: true,
      runSync: true,
    });
    expect(resolveDeployOptions({ ...base, DEPLOY_SYNC: '  ' }).runSync).toBe(true);
  });

  it('treats an unset variable as enabled (opt-out semantics)', () => {
    const options = resolveDeployOptions({});
    expect(options.runMigrations).toBe(true);
    expect(options.runSync).toBe(true);
  });
});

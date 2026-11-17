import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENV_SCENARIOS } from '../../fixtures/env.fixtures';
import { restoreEnv, setEnv } from '../../helpers/testEnv';

// env.ts calls dotenv.config() on import, which would re-inject the developer's
// real .env into the scrubbed process.env and make these tests depend on local
// machine state. Mock it out so scenarios are driven purely by setEnv().
vi.mock('dotenv', () => ({ default: { config: () => ({ parsed: {} }) } }));

describe('ENV configuration', () => {
  beforeEach(() => {
    setEnv({});
  });

  afterEach(() => {
    restoreEnv();
  });

  it.each(ENV_SCENARIOS)('$name', async ({ overrides, expected }) => {
    setEnv(overrides);

    const { ENV } = await import('@/config/env');

    expect(ENV.PORT).toBe(expected.PORT);
    expect(ENV.NODE_ENV).toBe(expected.NODE_ENV);
    expect(ENV.CORS_ORIGIN).toEqual(expected.CORS_ORIGIN);
    expect(ENV.ADMIN_WEB_URL).toBe(expected.ADMIN_WEB_URL);
    expect(ENV.FRONTEND_WEB_URL).toBe(expected.FRONTEND_WEB_URL);
  });
});

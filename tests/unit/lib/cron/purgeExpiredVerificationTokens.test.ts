import { describe, expect, it, vi } from 'vitest';
import { purgeExpiredVerificationTokens } from '@/lib/cron/functions/purgeExpiredVerificationTokens.job';

describe('cron purge job', () => {
  it('delegates to the token repository purge and returns the count', async () => {
    const repo = { purge: vi.fn(async () => 7) };
    const now = new Date('2026-01-01T00:00:00.000Z');

    const count = await purgeExpiredVerificationTokens(now, repo as never);

    expect(repo.purge).toHaveBeenCalledWith(now);
    expect(count).toBe(7);
  });

  it('reports zero when nothing is purged', async () => {
    const repo = { purge: vi.fn(async () => 0) };
    const count = await purgeExpiredVerificationTokens(new Date(), repo as never);
    expect(count).toBe(0);
  });
});

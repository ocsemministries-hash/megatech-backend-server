import { describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({ $transaction: vi.fn() }));

vi.mock('@/lib/dal/base/prisma.client', () => ({ prisma }));

import { prisma as mockedPrisma } from '@/lib/dal/base/prisma.client';
import { TransactionRunner } from '@/lib/dal/base/transaction';

describe('TransactionRunner', () => {
  it('delegates the unit of work to prisma.$transaction and returns its result', async () => {
    const txDb = { label: 'tx' };
    vi.mocked(mockedPrisma.$transaction).mockImplementation(async (work: never) =>
      (work as (db: unknown) => Promise<unknown>)(txDb)
    );
    const runner = new TransactionRunner();
    const seen: unknown[] = [];

    const result = await runner.run(async (db) => {
      seen.push(db);
      return 42;
    });

    expect(mockedPrisma.$transaction).toHaveBeenCalledOnce();
    expect(seen).toEqual([txDb]);
    expect(result).toBe(42);
  });
});

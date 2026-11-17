import { describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const model = () => ({ count: vi.fn(async () => 7) });
  return {
    prismaMock: {
      admin: model(),
      subscriber: model(),
      paymentTransaction: model(),
      $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    },
  };
});

vi.mock('@/lib/dal/base/prisma.client', () => ({ prisma: prismaMock }));

import { AdminDashboardUsecases } from '@/modules/admin/admin.dashboard.usecases';

describe('admin dashboard summary', () => {
  it('aggregates admins, subscribers and payments counts', async () => {
    const now = new Date('2026-10-28T12:00:00.000Z');
    const summary = await new AdminDashboardUsecases().summary(now);

    expect(summary.generatedAt).toBe('2026-10-28T12:00:00.000Z');
    expect(summary.counts.admins).toEqual({ total: 7, active: 7, pending: 7 });
    expect(summary.counts.subscribers).toEqual({ active: 7, total: 7 });
    expect(summary.counts.payments).toEqual({ total: 7, paid: 7, pending: 7 });
    expect(summary.badges).toEqual({ pendingAdmins: 7 });
    expect(prismaMock.admin.count).toHaveBeenCalledWith({ where: { status: 'PENDING' } });
    expect(prismaMock.paymentTransaction.count).toHaveBeenCalledWith({ where: { status: 'PAID' } });
  });
});

import { prisma } from '@/lib/dal/base/prisma.client';
import type { DashboardSummaryDto } from './admin.dashboard.output';

export class AdminDashboardUsecases {
  /** One round-trip dashboard summary of the modules this backend ships. */
  async summary(now: Date = new Date()): Promise<DashboardSummaryDto> {
    const [
      adminsTotal,
      adminsActive,
      adminsPending,
      subscribersActive,
      subscribersTotal,
      paymentsTotal,
      paymentsPaid,
      paymentsPending,
    ] = await prisma.$transaction([
      prisma.admin.count(),
      prisma.admin.count({ where: { status: 'ACTIVE' } }),
      prisma.admin.count({ where: { status: 'PENDING' } }),
      prisma.subscriber.count({ where: { status: 'ACTIVE' } }),
      prisma.subscriber.count(),
      prisma.paymentTransaction.count(),
      prisma.paymentTransaction.count({ where: { status: 'PAID' } }),
      prisma.paymentTransaction.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      generatedAt: now.toISOString(),
      counts: {
        admins: { total: adminsTotal, active: adminsActive, pending: adminsPending },
        subscribers: { active: subscribersActive, total: subscribersTotal },
        payments: { total: paymentsTotal, paid: paymentsPaid, pending: paymentsPending },
      },
      badges: { pendingAdmins: adminsPending },
    };
  }
}

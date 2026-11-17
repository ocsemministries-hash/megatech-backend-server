import type { NewsletterCampaign, Prisma, Subscriber, SubscriberStatus } from '@prisma/client';
import { prisma } from '../../base/prisma.client';
import { BaseRepository } from '../../base/base.repository';
import type { ModelDelegate } from '../../base/base.repository.types';
import type { DbClient } from '../../base/transaction';
import type {
  AdminCampaignListParams,
  AdminSubscriberListParams,
  CreateCampaignInput,
  UpdateCampaignInput,
  UpsertSubscriberInput,
} from './subscriber.schema';

/**
 * Mailing-list subscribers + broadcast campaigns. Subscriber rows are keyed by
 * email (unique), so signups are idempotent upserts while campaigns are
 * append-only records of what the admin sent.
 */
export class SubscriberRepository extends BaseRepository<Subscriber, UpsertSubscriberInput, Partial<Subscriber>> {
  constructor() {
    super(prisma.subscriber as unknown as ModelDelegate<Subscriber>);
  }

  async findByEmail(email: string, db: DbClient = prisma): Promise<Subscriber | null> {
    return db.subscriber.findUnique({ where: { email } });
  }

  async findByUnsubscribeToken(token: string, db: DbClient = prisma): Promise<Subscriber | null> {
    return db.subscriber.findUnique({ where: { unsubscribeToken: token } });
  }

  /** Creates a new subscriber row (callers check existence first). */
  async createSubscriber(data: UpsertSubscriberInput, db: DbClient = prisma): Promise<Subscriber> {
    return db.subscriber.create({ data });
  }

  /** Re-activates / refreshes an existing subscriber, clearing the opt-out stamp. */
  async reactivate(
    id: string,
    data: { name?: string | null; userId?: string | null },
    db: DbClient = prisma
  ): Promise<Subscriber> {
    return db.subscriber.update({
      where: { id },
      data: { status: 'ACTIVE', unsubscribedAt: null, ...data },
    });
  }

  /** Records a one-click opt-out. */
  async unsubscribe(token: string, db: DbClient = prisma): Promise<Subscriber> {
    return db.subscriber.update({
      where: { unsubscribeToken: token },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
    });
  }

  /** Admin manual status change. */
  async setStatus(id: string, status: SubscriberStatus, db: DbClient = prisma): Promise<Subscriber> {
    return db.subscriber.update({
      where: { id },
      data: {
        status,
        unsubscribedAt: status === 'UNSUBSCRIBED' ? new Date() : null,
      },
    });
  }

  async remove(id: string, db: DbClient = prisma): Promise<Subscriber> {
    return db.subscriber.delete({ where: { id } });
  }

  /** Every ACTIVE subscriber, for a broadcast (newest first). */
  async listActive(db: DbClient = prisma): Promise<Subscriber[]> {
    return db.subscriber.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
  }

  /** Admin list with search + status filter plus the total. */
  async listAdmin(params: AdminSubscriberListParams = {}): Promise<{ rows: Subscriber[]; total: number }> {
    const { page = 1, perPage = 20, search, status } = params;
    const where: Prisma.SubscriberWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.subscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: perPage,
        skip: (page - 1) * perPage,
      }),
      prisma.subscriber.count({ where }),
    ]);
    return { rows, total };
  }

  /** Global per-status totals for the subscriber tabs (read-only, no audit). */
  async countByStatus(): Promise<Record<string, number>> {
    const [groups, total] = await prisma.$transaction([
      prisma.subscriber.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.subscriber.count(),
    ]);
    const counts: Record<string, number> = { ALL: total };
    for (const group of groups) counts[group.status] = group._count.status;
    return counts;
  }

  // ── Campaigns ──────────────────────────────────────────────────────────

  async createCampaign(data: CreateCampaignInput, db: DbClient = prisma): Promise<NewsletterCampaign> {
    return db.newsletterCampaign.create({ data });
  }

  async findCampaignById(id: string, db: DbClient = prisma): Promise<NewsletterCampaign | null> {
    return db.newsletterCampaign.findUnique({ where: { id } });
  }

  async updateCampaign(id: string, data: UpdateCampaignInput, db: DbClient = prisma): Promise<NewsletterCampaign> {
    return db.newsletterCampaign.update({ where: { id }, data });
  }

  async listCampaigns(params: AdminCampaignListParams = {}): Promise<{ rows: NewsletterCampaign[]; total: number }> {
    const { page = 1, perPage = 20 } = params;
    const [rows, total] = await prisma.$transaction([
      prisma.newsletterCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        take: perPage,
        skip: (page - 1) * perPage,
      }),
      prisma.newsletterCampaign.count(),
    ]);
    return { rows, total };
  }
}

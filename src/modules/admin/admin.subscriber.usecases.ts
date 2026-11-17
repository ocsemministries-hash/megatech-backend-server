import type { SubscriberStatus } from '@prisma/client';
import { logger } from '@/utils/logger';
import { SubscriberRepository } from '@/lib/dal/repositories/subscriber/subscriber.repository';
import type { AdminSubscriberListParams } from '@/lib/dal/repositories/subscriber/subscriber.schema';
import { AuditLogRepository } from '@/lib/dal/repositories/auditLog/auditLog.repository';
import { TransactionRunner } from '@/lib/dal/base/transaction';
import { toAuditInput, type AdminAuditContext } from '@/lib/audit/auditContext';
import { eventBus } from '@/lib/events/event-bus';
import { SubscriberNotFoundError, CampaignNotFoundError } from '@/modules/newsletter/newsletter.errors';
import { NEWSLETTER_EVENTS } from './admin.newsletter.events';
import type { BroadcastNewsletterDto } from './admin.newsletter.validation';

const displayName = (ctx: AdminAuditContext): string =>
  `${ctx.actor.firstName} ${ctx.actor.lastName}`.trim() || ctx.actor.email;

/**
 * Admin mailing-list operations. Reads are audit-free; every mutation writes
 * exactly one audit row. Broadcasting never sends inline — it records the
 * campaign, then emits an event the background sender drains.
 */
export class AdminSubscriberUsecases {
  constructor(
    private readonly subscribers: SubscriberRepository = new SubscriberRepository(),
    private readonly auditLogs: AuditLogRepository = new AuditLogRepository(),
    private readonly tx: TransactionRunner = new TransactionRunner()
  ) {}

  /** Admin list: subscribers with search/filter plus total and tab counts. */
  async list(params: AdminSubscriberListParams = {}): Promise<{
    rows: Awaited<ReturnType<SubscriberRepository['listAdmin']>>['rows'];
    total: number;
    page: number;
    perPage: number;
    counts: Record<string, number>;
  }> {
    const { page = 1, perPage = 20 } = params;
    const [{ rows, total }, counts] = await Promise.all([
      this.subscribers.listAdmin(params),
      this.subscribers.countByStatus(),
    ]);
    return { rows, total, page, perPage, counts };
  }

  /** Every subscriber (optionally by status) for CSV export (read-only, no audit). */
  async exportAll(status?: SubscriberStatus) {
    const { rows } = await this.subscribers.listAdmin({ status, perPage: 100000, page: 1 });
    return rows;
  }

  /** Manual status change (resubscribe or opt a contact out). Idempotent. */
  async setStatus(ctx: AdminAuditContext, id: string, status: SubscriberStatus) {
    const current = await this.subscribers.findById(id);
    if (!current) throw new SubscriberNotFoundError();

    if (current.status !== status) {
      await this.tx.run(async (db) => {
        await this.subscribers.setStatus(id, status, db);
        await this.auditLogs.record(
          toAuditInput(ctx, 'subscriber.status_changed', `subscriber:${id}`, { from: current.status, to: status }),
          db
        );
      });
      logger.info(`[admin-subscriber] ${ctx.actor.email} set ${id} ${current.status} → ${status}`);
    }

    return this.subscribers.findById(id);
  }

  /** Permanently removes a subscriber. */
  async remove(ctx: AdminAuditContext, id: string) {
    const current = await this.subscribers.findById(id);
    if (!current) throw new SubscriberNotFoundError();

    await this.tx.run(async (db) => {
      await this.subscribers.remove(id, db);
      await this.auditLogs.record(
        toAuditInput(ctx, 'subscriber.removed', `subscriber:${id}`, { email: current.email }),
        db
      );
    });
    logger.info(`[admin-subscriber] ${ctx.actor.email} removed ${current.email}`);
  }

  /** Records a broadcast and hands it to the background sender. */
  async broadcast(ctx: AdminAuditContext, input: BroadcastNewsletterDto) {
    const recipients = await this.subscribers.listActive();

    const campaign = await this.tx.run(async (db) => {
      const created = await this.subscribers.createCampaign(
        {
          subject: input.subject,
          body: input.body,
          audience: 'ACTIVE',
          status: 'SENDING',
          recipientCount: recipients.length,
          createdByName: displayName(ctx),
        },
        db
      );
      await this.auditLogs.record(
        toAuditInput(ctx, 'subscriber.campaign_created', `campaign:${created.id}`, {
          subject: input.subject,
          recipients: recipients.length,
        }),
        db
      );
      return created;
    });

    logger.info(`[admin-subscriber] ${ctx.actor.email} queued campaign ${campaign.id} for ${recipients.length}`);
    eventBus.safeEmit(NEWSLETTER_EVENTS.CAMPAIGN_CREATED, { campaignId: campaign.id });
    return campaign;
  }

  /** Broadcast history, newest first (read-only, no audit). */
  async listCampaigns(params: { page?: number; perPage?: number } = {}) {
    const { page = 1, perPage = 20 } = params;
    const { rows, total } = await this.subscribers.listCampaigns({ page, perPage });
    return { rows, total, page, perPage };
  }

  /** One campaign detail (read-only, no audit). */
  async getCampaign(id: string) {
    const row = await this.subscribers.findCampaignById(id);
    if (!row) throw new CampaignNotFoundError();
    return row;
  }
}

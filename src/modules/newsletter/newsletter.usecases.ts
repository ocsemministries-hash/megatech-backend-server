import { logger } from '@/utils/logger';
import { escapeHtml } from '@/utils/escapeHtml';
import { SubscriberRepository } from '@/lib/dal/repositories/subscriber/subscriber.repository';
import type { SubscribeDto } from './validation.schema';

interface Submitter {
  id: string;
  email: string;
}

/**
 * Public mailing-list usecases. Signups are idempotent: the email is unique, so
 * re-subscribing refreshes the row and clears any prior opt-out. Signed-in
 * partners are recorded as source USER + their id; everyone else is PUBLIC.
 */
export class NewsletterUsecases {
  constructor(private readonly subscribers: SubscriberRepository = new SubscriberRepository()) {}

  async subscribe(input: SubscribeDto, submitter: Submitter | null) {
    const email = input.email.trim().toLowerCase();
    const name = input.name ? escapeHtml(input.name) : null;

    const existing = await this.subscribers.findByEmail(email);
    if (existing) {
      const needsName = name != null && name !== existing.name;
      const needsUserId = submitter != null && existing.userId !== submitter.id;
      if (existing.status === 'UNSUBSCRIBED' || needsName || needsUserId) {
        const row = await this.subscribers.reactivate(existing.id, {
          name: name ?? existing.name,
          userId: submitter?.id ?? existing.userId,
        });
        logger.info(`[newsletter] subscriber reactivated ${row.id}`);
        return row;
      }
      return existing;
    }

    const row = await this.subscribers.createSubscriber({
      email,
      name,
      source: submitter ? 'USER' : 'PUBLIC',
      userId: submitter?.id ?? null,
    });
    logger.info(`[newsletter] new ${row.source} subscriber ${row.id}`);
    return row;
  }

  /** One-click opt-out; returns whether the token matched a known subscriber. */
  async unsubscribe(token: string): Promise<boolean> {
    const existing = await this.subscribers.findByUnsubscribeToken(token);
    if (!existing) return false;
    if (existing.status !== 'UNSUBSCRIBED') {
      await this.subscribers.unsubscribe(token);
      logger.info(`[newsletter] subscriber ${existing.id} unsubscribed`);
    }
    return true;
  }
}

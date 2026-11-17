import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { escapeHtml } from '@/utils/escapeHtml';
import { sendMail } from '@/lib/mailer/mailer';
import { SubscriberRepository } from '@/lib/dal/repositories/subscriber/subscriber.repository';
import { eventBus } from '@/lib/events/event-bus';

export const NEWSLETTER_EVENTS = {
  CAMPAIGN_CREATED: 'newsletter.campaign_created',
} as const;

export interface CampaignCreatedPayload {
  campaignId: string;
}

/** Small concurrency window so a large list never opens hundreds of sockets at once. */
const SEND_CONCURRENCY = 10;

/** Plain-text author body → escaped HTML paragraphs, preserving single line breaks. */
const toBodyHtml = (text: string): string =>
  escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px">${paragraph.replace(/\n/g, '<br/>')}</p>`)
    .join('');

const unsubscribeUrl = (token: string): string =>
  `${ENV.API_PUBLIC_URL}/api/v1/newsletter/unsubscribe/${token}`;

/**
 * Drains a queued campaign: sends one email per ACTIVE subscriber and records
 * the delivery counts. Runs on the event bus so the admin request returns
 * immediately; every failure is contained (never rethrown into the request).
 */
const handleCampaignCreated = async ({ campaignId }: CampaignCreatedPayload): Promise<void> => {
  const subscribers = new SubscriberRepository();
  try {
    const campaign = await subscribers.findCampaignById(campaignId);
    if (!campaign) {
      logger.warn(`[newsletter] campaign ${campaignId} not found; skipping send`);
      return;
    }
    if (campaign.status !== 'SENDING') {
      logger.warn(`[newsletter] campaign ${campaignId} is ${campaign.status}; skipping send`);
      return;
    }

    const recipients = await subscribers.listActive();
    const subject = campaign.subject;
    const safeSubject = escapeHtml(subject);
    const bodyHtml = toBodyHtml(campaign.body);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += SEND_CONCURRENCY) {
      const chunk = recipients.slice(i, i + SEND_CONCURRENCY);
      const results = await Promise.all(
        chunk.map(async (recipient) => {
          const mail = await sendMail({
            to: recipient.email,
            subject,
            template: 'newsletterMailTemp',
            data: [safeSubject, bodyHtml, unsubscribeUrl(recipient.unsubscribeToken)],
          });
          return mail.delivered;
        })
      );
      for (const delivered of results) delivered ? (sent += 1) : (failed += 1);
    }

    await subscribers.updateCampaign(campaignId, {
      status: 'SENT',
      sentCount: sent,
      failedCount: failed,
      sentAt: new Date(),
    });
    logger.info(`[newsletter] campaign ${campaignId} sent to ${sent}/${recipients.length} (${failed} failed)`);
  } catch (error) {
    logger.error(`[newsletter] campaign ${campaignId} send failed:`, error);
    try {
      await subscribers.updateCampaign(campaignId, { status: 'FAILED' });
    } catch (updateError) {
      logger.error(`[newsletter] failed to mark campaign ${campaignId} failed:`, updateError);
    }
  }
};

export const registerNewsletterEventListeners = (): void => {
  eventBus.safeOn<CampaignCreatedPayload>(NEWSLETTER_EVENTS.CAMPAIGN_CREATED, handleCampaignCreated);
};

export { handleCampaignCreated };

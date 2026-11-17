import type { NewsletterCampaign, Subscriber } from '@prisma/client';

/** Submission origin as the admin UI reads it: `user` = signed-in partner. */
export type SubscriberSourceDto = 'public' | 'user';

/** Admin subscriber row: everything the mailing-list table shows. */
export interface AdminSubscriberDto {
  id: string;
  email: string;
  name: string | null;
  source: SubscriberSourceDto;
  userId: string | null;
  status: 'ACTIVE' | 'UNSUBSCRIBED';
  subscribedAt: string;
  unsubscribedAt: string | null;
  createdAt: string;
}

/** Shapes one subscriber row; Dates leave as ISO strings, raw rows never leave. */
export const toAdminSubscriberDto = (row: Subscriber): AdminSubscriberDto => ({
  id: row.id,
  email: row.email,
  name: row.name,
  source: row.source === 'USER' ? 'user' : 'public',
  userId: row.userId,
  status: row.status,
  subscribedAt: row.subscribedAt.toISOString(),
  unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

/** Shapes a paginated subscriber list (DTO rows plus the paging envelope and tab counts). */
export const toAdminSubscriberListDto = (result: {
  rows: Subscriber[];
  total: number;
  page: number;
  perPage: number;
  counts: Record<string, number>;
}) => ({
  rows: result.rows.map(toAdminSubscriberDto),
  total: result.total,
  page: result.page,
  perPage: result.perPage,
  counts: result.counts,
});

/** Admin campaign row: broadcast history with delivery counts. */
export interface AdminCampaignDto {
  id: string;
  subject: string;
  body: string;
  status: 'DRAFT' | 'SENDING' | 'SENT' | 'FAILED';
  audience: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdByName: string | null;
  sentAt: string | null;
  createdAt: string;
}

/** Shapes one campaign row; raw rows never leave. */
export const toAdminCampaignDto = (row: NewsletterCampaign): AdminCampaignDto => ({
  id: row.id,
  subject: row.subject,
  body: row.body,
  status: row.status,
  audience: row.audience,
  recipientCount: row.recipientCount,
  sentCount: row.sentCount,
  failedCount: row.failedCount,
  createdByName: row.createdByName,
  sentAt: row.sentAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

/** Shapes a paginated campaign list. */
export const toAdminCampaignListDto = (result: {
  rows: NewsletterCampaign[];
  total: number;
  page: number;
  perPage: number;
}) => ({
  rows: result.rows.map(toAdminCampaignDto),
  total: result.total,
  page: result.page,
  perPage: result.perPage,
});

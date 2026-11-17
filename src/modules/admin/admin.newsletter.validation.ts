import { z } from 'zod';

const SUBSCRIBER_STATUSES = ['ACTIVE', 'UNSUBSCRIBED'] as const;

export const adminSubscriberListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(SUBSCRIBER_STATUSES).optional(),
});

export const setSubscriberStatusSchema = z.object({
  status: z.enum(SUBSCRIBER_STATUSES),
});

/** Compose-and-send payload. Body is plain text; escaped + wrapped at send time. */
export const broadcastNewsletterSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200, 'Subject must be at most 200 characters'),
  body: z.string().trim().min(1, 'Body is required').max(20000, 'Body must be at most 20000 characters'),
});

export const adminCampaignListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminSubscriberListQuery = z.infer<typeof adminSubscriberListQuerySchema>;
export type SetSubscriberStatusDto = z.infer<typeof setSubscriberStatusSchema>;
export type BroadcastNewsletterDto = z.infer<typeof broadcastNewsletterSchema>;
export type AdminCampaignListQuery = z.infer<typeof adminCampaignListQuerySchema>;

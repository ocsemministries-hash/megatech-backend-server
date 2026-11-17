import type { CampaignStatus, SubscriberStatus, SubmissionSource } from '@prisma/client';

/** Upsert payload for a public newsletter signup. */
export interface UpsertSubscriberInput {
  email: string;
  name?: string | null;
  source: SubmissionSource;
  userId?: string | null;
}

export interface AdminSubscriberListParams {
  page?: number;
  perPage?: number;
  search?: string;
  status?: SubscriberStatus;
}

export interface CreateCampaignInput {
  subject: string;
  body: string;
  audience?: string;
  createdByName?: string | null;
  status?: CampaignStatus;
  recipientCount?: number;
}

export interface UpdateCampaignInput {
  status?: CampaignStatus;
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
  sentAt?: Date;
}

export interface AdminCampaignListParams {
  page?: number;
  perPage?: number;
}

import type { Subscriber } from '@prisma/client';

/** Public signup receipt: confirms the subscription, never leaks the token. */
export interface SubscriberReceiptDto {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}

/** Shapes the created/updated row into a public receipt. */
export const toSubscriberReceiptDto = (row: Subscriber): SubscriberReceiptDto => ({
  id: row.id,
  email: row.email,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
});

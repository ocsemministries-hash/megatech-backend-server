import { z } from 'zod';

/** Public mailing-list signup from the site footer. */
export const subscribeSchema = z.object({
  email: z.string().trim().email('Must be a valid email').max(254, 'Must be at most 254 characters'),
  name: z.string().trim().min(1).max(120, 'Name must be at most 120 characters').optional().nullable(),
});

export type SubscribeDto = z.infer<typeof subscribeSchema>;

/** One-click opt-out payload (token comes from a campaign email). */
export const unsubscribeSchema = z.object({
  token: z.string().trim().min(1, 'Token is required').max(200, 'Token is too long'),
});

export type UnsubscribeDto = z.infer<typeof unsubscribeSchema>;

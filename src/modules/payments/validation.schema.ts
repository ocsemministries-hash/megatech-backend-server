import { z } from 'zod';

export const initializePaymentSchema = z.object({
  amount: z.number().finite().positive().max(10_000_000).refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7, 'Amount supports up to two decimal places'),
  currency: z.enum(['NGN', 'USD', 'GBP']).default('NGN'),
  purpose: z.string().trim().min(1).max(80).default('GENERAL'),
});

export const verifyPaymentParamsSchema = z.object({ reference: z.string().trim().min(8).max(120) });

export type InitializePaymentInput = z.infer<typeof initializePaymentSchema>;

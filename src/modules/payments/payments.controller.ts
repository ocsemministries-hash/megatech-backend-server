import { randomUUID } from 'node:crypto';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@/lib/dal/base/prisma.client';
import { ENV } from '@/config/env';
import { HttpError } from '@/lib/errors/http.error';
import { routeParam } from '@/utils/routeParam';
import type { InitializePaymentInput } from './validation.schema';

type PaystackResponse = {
  status?: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
  };
};

type PaymentTransactionDtoSource = {
  id: string; reference: string; amountMinor: number; currency: string; purpose: string;
  status: string; authorizationUrl: string | null; receiptNo: string | null; paidAt: Date | null; createdAt: Date;
  user?: { firstName: string; lastName: string; email: string };
};

const paystackRequest = async (path: string, init?: RequestInit): Promise<PaystackResponse> => {
  if (!ENV.PAYSTACK_SECRET_KEY) {
    throw new HttpError(503, 'Payments are not configured yet. Please try again later.');
  }
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${ENV.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as PaystackResponse;
  if (!response.ok || !body.status) {
    throw new HttpError(response.status >= 500 ? 502 : 400, body.message || 'Payment provider request failed.');
  }
  return body;
};

const publicTransaction = (row: PaymentTransactionDtoSource) => ({
  id: row.id,
  providerRef: row.reference,
  amount: row.amountMinor / 100,
  currency: row.currency,
  purpose: row.purpose,
  status: row.status,
  authorizationUrl: row.authorizationUrl,
  receiptNo: row.receiptNo,
  paidAt: row.paidAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  partnerName: row.user ? `${row.user.firstName} ${row.user.lastName}`.trim() : '',
  partnerEmail: row.user?.email ?? '',
});

export class PaymentsController {
  webhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!ENV.PAYSTACK_SECRET_KEY) throw new HttpError(503, 'Payment webhook is not configured.');
      const signature = req.header('x-paystack-signature') ?? '';
      const expected = createHmac('sha512', ENV.PAYSTACK_SECRET_KEY).update(req.rawBody ?? Buffer.alloc(0)).digest();
      const supplied = Buffer.from(signature, 'hex');
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        res.status(401).json({ success: false, error: 'Invalid payment webhook signature.' });
        return;
      }
      const event = req.body as { event?: string; data?: { reference?: string } };
      if (event.event !== 'charge.success' || !event.data?.reference) {
        res.status(200).json({ received: true });
        return;
      }
      const transaction = await prisma.paymentTransaction.findUnique({ where: { reference: event.data.reference } });
      if (!transaction || transaction.status === 'PAID') {
        res.status(200).json({ received: true });
        return;
      }
      const result = await paystackRequest(`/transaction/verify/${encodeURIComponent(transaction.reference)}`);
      const payment = result.data;
      const isPaid = payment?.status === 'success'
        && payment.reference === transaction.reference
        && payment.amount === transaction.amountMinor
        && payment.currency === transaction.currency;
      if (isPaid) {
        await prisma.paymentTransaction.updateMany({
          where: { id: transaction.id, status: 'PENDING' },
          data: { status: 'PAID', paidAt: new Date(), receiptNo: `MEGATECH-${transaction.reference.slice(-12).toUpperCase()}` },
        });
      }
      res.status(200).json({ received: true });
    } catch (error) { next(error); }
  };

  initialize = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true, firstName: true, lastName: true, status: true } });
      if (!user || user.status !== 'ACTIVE') {
        res.status(403).json({ success: false, error: 'An active account is required to make a payment.' });
        return;
      }
      const input = req.body as InitializePaymentInput;
      const amountMinor = Math.round(input.amount * 100);
      if (amountMinor < 100) {
        res.status(400).json({ success: false, error: 'The minimum amount is 1.00 in the selected currency.' });
        return;
      }
      const reference = `megatech_${randomUUID()}`;
      const transaction = await prisma.paymentTransaction.create({
        data: { userId: user.id, reference, amountMinor, currency: input.currency, purpose: input.purpose },
      });
      try {
        const result = await paystackRequest('/transaction/initialize', {
          method: 'POST',
          body: JSON.stringify({
            email: user.email,
            amount: amountMinor,
            currency: input.currency,
            reference,
            callback_url: `${ENV.FRONTEND_WEB_URL}/payments/result`,
            metadata: { userId: user.id, paymentId: transaction.id, purpose: input.purpose },
          }),
        });
        if (!result.data?.authorization_url || result.data.reference !== reference) {
          throw new Error('The payment provider returned an invalid checkout response.');
        }
        const updated = await prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: { authorizationUrl: result.data.authorization_url },
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        });
        res.status(201).json({ success: true, data: { transaction: publicTransaction(updated) } });
      } catch (error) {
        await prisma.paymentTransaction.update({ where: { id: transaction.id }, data: { status: 'FAILED' } });
        throw error;
      }
    } catch (error) { next(error); }
  };

  verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reference = routeParam(req.params.reference);
      const transaction = await prisma.paymentTransaction.findFirst({ where: { reference, userId: req.user!.id }, include: { user: { select: { firstName: true, lastName: true, email: true } } } });
      if (!transaction) {
        res.status(404).json({ success: false, error: 'Payment not found.' });
        return;
      }
      if (transaction.status === 'PAID') {
        res.json({ success: true, data: { transaction: publicTransaction(transaction) } });
        return;
      }
      const result = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
      const payment = result.data;
      const isPaid = payment?.status === 'success'
        && payment.reference === transaction.reference
        && payment.amount === transaction.amountMinor
        && payment.currency === transaction.currency;
      await prisma.paymentTransaction.updateMany({
        where: { id: transaction.id, status: 'PENDING' },
        data: isPaid
          ? { status: 'PAID', paidAt: new Date(), receiptNo: `MEGATECH-${transaction.reference.slice(-12).toUpperCase()}` }
          : { status: payment?.status === 'failed' ? 'FAILED' : 'PENDING' },
      });
      const updated = await prisma.paymentTransaction.findUniqueOrThrow({
        where: { id: transaction.id },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      });
      res.json({ success: true, data: { transaction: publicTransaction(updated) } });
    } catch (error) { next(error); }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rows = await prisma.paymentTransaction.findMany({
        where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 100,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      });
      res.json({ success: true, data: { items: rows.map(publicTransaction), total: rows.length, page: 1, perPage: rows.length } });
    } catch (error) { next(error); }
  };
}

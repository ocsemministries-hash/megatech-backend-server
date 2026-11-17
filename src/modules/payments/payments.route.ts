import { Router } from 'express';
import { authenticateUser } from '@/middlewares/auth/authenticateUser.middleware';
import { validate } from '@/middlewares/validate';
import { PaymentsController } from './payments.controller';
import { initializePaymentSchema } from './validation.schema';

/** Paystack payments router. Mount at /api/v1/payments. */
export const paymentsRouter = (): Router => {
  const router = Router();
  const controller = new PaymentsController();
  router.post('/webhook', controller.webhook);
  router.use(authenticateUser);
  router.post('/initialize', validate(initializePaymentSchema), controller.initialize);
  router.get('/mine', controller.listMine);
  router.get('/verify/:reference', controller.verify);
  return router;
};

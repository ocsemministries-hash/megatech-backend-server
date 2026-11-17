import { Router } from 'express';
import { NewsletterController } from './newsletter.controller';
import { validate } from '@/middlewares/validate';
import { optionalUser } from '@/middlewares/auth/optionalUser.middleware';
import { submissionLimiter } from '@/middlewares/rateLimit';
import { subscribeSchema, unsubscribeSchema } from './validation.schema';

/**
 * Public newsletter router. Mount at /api/v1/newsletter.
 * `optionalUser` attaches the signed-in user when present so the usecase
 * records source USER + userId; anonymous signups stay PUBLIC.
 */
export const newsletterRouter = (): Router => {
  const router = Router();
  const controller = new NewsletterController();

  router.post('/subscribe', submissionLimiter, optionalUser, validate(subscribeSchema), controller.subscribe);
  router.post('/unsubscribe', validate(unsubscribeSchema), controller.unsubscribe);
  router.get('/unsubscribe/:token', controller.unsubscribeLink);

  return router;
};

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AdminController } from './admin.controller';
import { validate } from '@/middlewares/validate';
import { authenticateAdmin } from '@/middlewares/auth/authenticateAdmin.middleware';
import { rbac } from '@/middlewares/auth/authorizeRbac.middleware';
import {
  acceptInviteSchema,
  inviteAdminSchema,
  listAdminsQuerySchema,
  updateAdminSchema,
} from './validation.schema';
import { validateQuery } from '@/middlewares/validateQuery';
import {
  adminCampaignListQuerySchema,
  adminSubscriberListQuerySchema,
  broadcastNewsletterSchema,
  setSubscriberStatusSchema,
} from './admin.newsletter.validation';

/** Rejects non-uuid `:id` params with 400 before any repository call can throw a Prisma error. */
const adminResourceIdParamSchema = z.object({ id: z.string().uuid() });

const validateIdParam =
  (schema: z.ZodType<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'A valid id is required' });
      return;
    }
    next();
  };

const validateAdminId = validateIdParam(adminResourceIdParamSchema);

/**
 * Admin management router. Mount at /api/v1/admin.
 * Protected routes require an authenticated admin; invite accept is public
 * (the signed-in invite token in the URL is the credential).
 */
export const adminRouter = (): Router => {
  const router = Router();
  const controller = new AdminController();

  router.get('/admins', authenticateAdmin, rbac('admins', 'view'), validateQuery(listAdminsQuerySchema), controller.list);
  router.get('/admins/:id', authenticateAdmin, rbac('admins', 'view'), validateAdminId, controller.getById);
  router.post('/admins/invite', authenticateAdmin, rbac('admins', 'create'), validate(inviteAdminSchema), controller.invite);
  router.patch('/admins/:id', authenticateAdmin, rbac('admins', 'update'), validateAdminId, validate(updateAdminSchema), controller.update);
  router.delete('/admins/:id', authenticateAdmin, rbac('admins', 'delete'), validateAdminId, controller.delete);

  router.post('/invite/:token/accept', validate(acceptInviteSchema), controller.acceptInvite);

  router.get(
    '/subscribers',
    authenticateAdmin,
    rbac('subscribers', 'view'),
    validateQuery(adminSubscriberListQuerySchema),
    controller.listSubscribers
  );
  router.get(
    '/subscribers/export',
    authenticateAdmin,
    rbac('subscribers', 'export'),
    validateQuery(adminSubscriberListQuerySchema),
    controller.exportSubscribers
  );
  router.patch(
    '/subscribers/:id/status',
    authenticateAdmin,
    rbac('subscribers', 'update'),
    validateAdminId,
    validate(setSubscriberStatusSchema),
    controller.setSubscriberStatus
  );
  router.delete(
    '/subscribers/:id',
    authenticateAdmin,
    rbac('subscribers', 'delete'),
    validateAdminId,
    controller.removeSubscriber
  );

  router.get(
    '/newsletter-campaigns',
    authenticateAdmin,
    rbac('subscribers', 'view'),
    validateQuery(adminCampaignListQuerySchema),
    controller.listCampaigns
  );
  router.get(
    '/newsletter-campaigns/:id',
    authenticateAdmin,
    rbac('subscribers', 'view'),
    validateAdminId,
    controller.getCampaign
  );
  router.post(
    '/newsletter-campaigns',
    authenticateAdmin,
    rbac('subscribers', 'create'),
    validate(broadcastNewsletterSchema),
    controller.broadcastNewsletter
  );

  router.get(
    '/dashboard/summary',
    authenticateAdmin,
    rbac('dashboard', 'view'),
    controller.getDashboardSummary
  );

  return router;
};

import { Router } from 'express';
import { RbacController } from './rbac.controller';
import { validate } from '@/middlewares/validate';
import { authenticateAdmin } from '@/middlewares/auth/authenticateAdmin.middleware';
import { rbac } from '@/middlewares/auth/authorizeRbac.middleware';
import { updateRolePermissionsSchema } from './validation.schema';

/**
 * RBAC router. Mount at /api/v1/admin. All routes require an authenticated
 * admin; role/permission mutations require the matching admin permission.
 */
export const rbacRouter = (): Router => {
  const router = Router();
  const controller = new RbacController();

  router.get('/rbac/resources', authenticateAdmin, rbac('roles', 'view'), controller.resources);
  router.get('/rbac/permissions', authenticateAdmin, rbac('roles', 'view'), controller.resources);
  router.get('/roles', authenticateAdmin, rbac('roles', 'view'), controller.listRoles);
  router.get('/roles/:id', authenticateAdmin, rbac('roles', 'view'), controller.getRole);
  router.patch(
    '/roles/:id/permissions',
    authenticateAdmin,
    rbac('roles', 'update'),
    validate(updateRolePermissionsSchema),
    controller.updateRolePermissions
  );
  router.delete('/roles/:id', authenticateAdmin, rbac('roles', 'delete'), controller.deleteRole);

  return router;
};

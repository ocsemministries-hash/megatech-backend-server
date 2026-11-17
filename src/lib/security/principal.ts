import type { AdminPrincipal } from '@/types/auth';
import type { AdminRoleShape } from '@/lib/dal/repositories/admin/admin.schema';
import type { Admin } from '@prisma/client';

export type AdminWithPermissions = Admin & AdminRoleShape;

/** Minimal actor surface needed by mutating usecases (matches both a full row and req.admin). */
export type AdminActor = Pick<AdminPrincipal, 'id' | 'email' | 'firstName' | 'lastName' | 'isSuperAdmin'>;

/** Builds the authenticated principal (embedded in the access token) from an admin row. */
export const buildPrincipal = (admin: AdminWithPermissions): AdminPrincipal => ({
  id: admin.id,
  email: admin.email,
  firstName: admin.firstName,
  lastName: admin.lastName,
  roleId: admin.roleId,
  roleName: admin.roleName,
  isSuperAdmin: admin.isSuperAdmin,
  permissions: admin.permissions,
});

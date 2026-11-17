import { AdminRepository } from '@/lib/dal/repositories/admin/admin.repository';
import { PermissionRepository } from '@/lib/dal/repositories/permission/permission.repository';
import { RoleRepository } from '@/lib/dal/repositories/role/role.repository';
import { RBAC_ACTIONS, RBAC_RESOURCES } from '@/lib/security/rbac.constants';
import type { RoleRecord, RoleListResult, RbacResourcesResult } from './rbac.types';
import {
  RbacPermissionInvalidError,
  RbacRoleNotFoundError,
  RbacSuperAdminRoleError,
  RbacSystemRoleError,
} from './rbac.errors';
import type { UpdateRolePermissionsDto } from './validation.schema';

export class RbacUsecases {
  constructor(
    private readonly roles: RoleRepository = new RoleRepository(),
    private readonly permissions: PermissionRepository = new PermissionRepository(),
    private readonly admins: AdminRepository = new AdminRepository()
  ) {}

  async resources(): Promise<RbacResourcesResult> {
    return { resources: RBAC_RESOURCES, actions: RBAC_ACTIONS };
  }

  async listRoles(): Promise<RoleListResult> {
    const rows = await this.roles.listWithPermissionsAndCounts();
    return { roles: rows as RoleRecord[] };
  }

  async getRole(id: string): Promise<RoleRecord> {
    const role = await this.roles.findByIdWithPermissions(id);
    if (!role) throw new RbacRoleNotFoundError();
    return {
      ...role,
      adminCount: await this.admins.countByRole(id),
    } as RoleRecord;
  }

  async updateRolePermissions(roleId: string, input: UpdateRolePermissionsDto): Promise<RoleRecord> {
    const role = await this.roles.findById(roleId);
    if (!role) throw new RbacRoleNotFoundError();
    if (role.name === 'SUPER_ADMIN' && !(input.permissionKeys.length > 0)) {
      throw new RbacSuperAdminRoleError();
    }

    const existing = await this.permissions.countExistingByIds(input.permissionKeys);
    if (existing !== input.permissionKeys.length) {
      throw new RbacPermissionInvalidError();
    }

    await this.roles.assignPermissions(roleId, input.permissionKeys);
    return this.getRole(roleId);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.roles.findById(id);
    if (!role) throw new RbacRoleNotFoundError();
    if (role.isSystem) throw new RbacSystemRoleError();
    if ((await this.admins.countByRole(id)) > 0) {
      throw new RbacSystemRoleError();
    }
    await this.roles.hardDeleteRole(id);
  }
}

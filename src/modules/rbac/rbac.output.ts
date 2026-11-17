import type { RoleRecord, RoleListResult, RbacResourcesResult } from './rbac.types';

export const toRoleDto = (role: RoleRecord) => ({
  id: role.id,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  permissionKeys: role.permissionKeys,
  adminCount: role.adminCount,
  createdAt: role.createdAt.toISOString(),
});

export const toRoleListDto = (result: RoleListResult) => ({
  roles: result.roles.map(toRoleDto),
});

export const toResourcesDto = (result: RbacResourcesResult) => ({
  resources: [...result.resources],
  actions: [...result.actions],
});

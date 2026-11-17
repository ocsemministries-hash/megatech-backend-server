import type { RoleName } from '@prisma/client';
import type { RbacAction, RbacResource } from '@/lib/security/rbac.constants';

export interface RbacResourcesResult {
  resources: readonly RbacResource[];
  actions: readonly RbacAction[];
}

export interface RoleRecord {
  id: string;
  name: RoleName;
  description: string | null;
  isSystem: boolean;
  permissionKeys: string[];
  adminCount: number;
  createdAt: Date;
}

export interface RoleListResult {
  roles: RoleRecord[];
}

export type { RoleName };

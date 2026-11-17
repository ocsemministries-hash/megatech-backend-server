import type { RoleName } from '@prisma/client';

export interface CreateRoleInput {
  name: RoleName;
  description?: string;
  isSystem?: boolean;
}

export interface UpdateRoleInput {
  name?: RoleName;
  description?: string;
  isSystem?: boolean;
}

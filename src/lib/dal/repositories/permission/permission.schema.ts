import type { PermissionAction } from '@prisma/client';

export interface CreatePermissionInput {
  id: string;
  resource: string;
  action: PermissionAction;
}

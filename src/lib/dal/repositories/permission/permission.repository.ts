import type { Permission } from '@prisma/client';
import { prisma } from '../../base/prisma.client';
import { BaseRepository } from '../../base/base.repository';
import type { ModelDelegate } from '../../base/base.repository.types';
import type { CreatePermissionInput } from './permission.schema';

// NOTE: permissions are provisioned by the additive startup sync
// (`src/lib/security/rbac.sync.ts`) — the repository stays read/lookup-only
// so nothing can overwrite or reseed the matrix from elsewhere.

export class PermissionRepository extends BaseRepository<Permission, CreatePermissionInput, { description?: never }> {
  constructor() {
    super(prisma.permission as unknown as ModelDelegate<Permission>);
  }

  async listAll(): Promise<Permission[]> {
    return prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  }

  /** Number of existing permissions whose ids are in `keys`. */
  async countExistingByIds(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return prisma.permission.count({ where: { id: { in: keys } } });
  }
}

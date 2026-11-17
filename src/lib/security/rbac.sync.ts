import { prisma } from '../dal/base/prisma.client';
import { RBAC_ACTIONS, RBAC_RESOURCES, SYSTEM_ROLES, permissionKey } from './rbac.constants';

export interface PermissionSyncResult {
  /** Size of the full resource x action matrix. */
  total: number;
  /** Rows that were missing and have just been inserted. */
  added: number;
  /** Rows that already existed — left untouched. */
  skipped: number;
}

/**
 * Startup permission sync (additive-only).
 *
 * For every `resource:action` combination in the registry, inserts the row
 * when it does not exist yet and leaves everything else alone: no deletes,
 * no role updates. Safe to run on every boot; extend `RBAC_RESOURCES` (or
 * `RBAC_ACTIONS`) and the new keys land in the DB on the next start.
 */
export const syncPermissions = async (
  resources: readonly string[] = RBAC_RESOURCES,
  actions: readonly string[] = RBAC_ACTIONS
): Promise<PermissionSyncResult> => {
  const ids = resources.flatMap((resource) =>
    actions.map((action) => permissionKey(resource, action))
  );

  if (ids.length === 0) return { total: 0, added: 0, skipped: 0 };

  const existing = await prisma.permission.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((row) => row.id));

  const missing = ids.filter((id) => !existingIds.has(id));
  if (missing.length === 0) {
    return { total: ids.length, added: 0, skipped: ids.length };
  }

  const byId = new Map<string, { resource: string; action: string }>();
  for (const resource of resources) {
    for (const action of actions) {
      byId.set(permissionKey(resource, action), { resource, action });
    }
  }

  await prisma.permission.createMany({
    data: missing.map((id) => {
      const entry = byId.get(id);
      if (!entry) throw new Error(`Unknown permission key: ${id}`);
      return {
        id,
        resource: entry.resource,
        action: entry.action.toUpperCase() as 'VIEW' | 'CREATE' | 'EXPORT' | 'UPDATE' | 'DELETE',
      };
    }),
    skipDuplicates: true,
  });

  return { total: ids.length, added: missing.length, skipped: ids.length - missing.length };
};

export interface RoleSyncResult {
  /** System roles in the registry. */
  total: number;
  /** Roles that were missing and have just been created. */
  added: number;
  /** Roles that already existed — left untouched. */
  skipped: number;
}

/**
 * Startup role sync (create-only).
 *
 * Creates any missing system role (SUPER_ADMIN, ADMIN, EDITOR, VIEWER) so a
 * fresh database can register its first super admin without running the seed.
 * Existing roles are never updated and no permissions are granted here — the
 * default role grants stay in `prisma/seed.ts`, so a grant a super admin
 * revoked is not silently restored on every boot.
 */
export const syncRoles = async (roles: readonly { name: string; description: string; isSystem: boolean }[] = SYSTEM_ROLES): Promise<RoleSyncResult> => {
  if (roles.length === 0) return { total: 0, added: 0, skipped: 0 };
  const result = await prisma.role.createMany({
    data: roles.map((role) => ({
      id: role.name.toLowerCase(),
      name: role.name as 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'VIEWER',
      description: role.description,
      isSystem: role.isSystem,
    })),
    // Conflicts on id or name mean the role exists: skip it, never overwrite.
    skipDuplicates: true,
  });
  return { total: roles.length, added: result.count, skipped: roles.length - result.count };
};

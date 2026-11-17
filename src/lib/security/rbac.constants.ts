/**
 * Canonical RBAC resource registry for the Megatech backend.
 *
 * Add a new entry here when a new module ships — the startup permission
 * sync (`syncPermissions`) will insert whatever `resource:action` rows are
 * missing from the DB. Nothing is ever deleted by the sync, so removing an
 * entry here does not prune old rows (clean those up manually if needed).
 */
export const RBAC_RESOURCES = [
  'admins',
  'roles',
  'accounts',
  'profile',
  'audit',
  'dashboard',
  'subscribers',
] as const;

export type RbacResource = (typeof RBAC_RESOURCES)[number];

export const RBAC_ACTIONS = ['view', 'create', 'export', 'update', 'delete'] as const;

export type RbacAction = (typeof RBAC_ACTIONS)[number];

export const isRbacResource = (value: string): value is RbacResource =>
  (RBAC_RESOURCES as readonly string[]).includes(value);

export const isRbacAction = (value: string): value is RbacAction =>
  (RBAC_ACTIONS as readonly string[]).includes(value);

/** Stable permission key: `accounts:update`. Matches Permission.id and JWT claims. */
export const permissionKey = (resource: RbacResource | string, action: RbacAction | string): string =>
  `${resource}:${action.toLowerCase()}`;

/**
 * The four system roles every environment needs (registration requires
 * SUPER_ADMIN). Ids are the lower-cased names. Created on boot by `syncRoles`
 * (create-only) and upserted by `prisma/seed.ts`.
 */
export const SYSTEM_ROLES = [
  { name: 'SUPER_ADMIN', description: 'System super administrator', isSystem: true },
  { name: 'ADMIN', description: 'Administrator', isSystem: false },
  { name: 'EDITOR', description: 'Editor', isSystem: false },
  { name: 'VIEWER', description: 'Read-only viewer', isSystem: false },
] as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[number]['name'];

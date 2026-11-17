import { RBAC_ACTIONS, SYSTEM_ROLES, permissionKey } from '../src/lib/security/rbac.constants';
import { syncPermissions } from '../src/lib/security/rbac.sync';
import { prisma } from '../src/lib/dal/base/prisma.client';

/** Default grants for the baseline resources (add-only, idempotent). */
const DEFAULT_GRANTS: Record<string, readonly string[]> = {
  ADMIN: RBAC_ACTIONS as unknown as string[],
  EDITOR: ['view', 'create', 'update'],
  VIEWER: ['view'],
};

const GRANTED_RESOURCES = ['admins', 'roles', 'accounts', 'profile', 'audit', 'subscribers'] as const;

/**
 * Grants the baseline permissions to the system roles. Add-only: existing
 * rows are left alone (createMany with skipDuplicates), so re-running the seed
 * never removes a grant an admin revoked on purpose.
 */
export async function seedDefaultGrants(): Promise<number> {
  const roles = await prisma.role.findMany({
    where: { name: { in: Object.keys(DEFAULT_GRANTS) as ('ADMIN' | 'EDITOR' | 'VIEWER')[] } },
    select: { id: true, name: true },
  });
  const roleIdByName = new Map(roles.map((role) => [role.name, role.id]));

  const data: { roleId: string; permissionId: string }[] = [];
  for (const resource of GRANTED_RESOURCES) {
    for (const [roleName, actions] of Object.entries(DEFAULT_GRANTS)) {
      const roleId = roleIdByName.get(roleName);
      if (!roleId) continue;
      for (const action of actions) {
        data.push({ roleId, permissionId: permissionKey(resource, action) });
      }
    }
  }

  // Dashboard is read-only for every non-super role, so it only gets `view`.
  for (const roleId of roleIdByName.values()) {
    data.push({ roleId, permissionId: permissionKey('dashboard', 'view') });
  }

  if (data.length === 0) return 0;
  const result = await prisma.rolePermission.createMany({ data, skipDuplicates: true });
  return result.count;
}

// Same registry the boot-time role sync uses; the seed additionally refreshes descriptions.
const ROLES = SYSTEM_ROLES;

async function seedRoles() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystem: role.isSystem },
      create: {
        id: role.name.toLowerCase(),
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
    });
  }
  console.log(`Roles seeded: ${ROLES.map(r=>r.name).join(', ')}`);
}

async function main() {
  await seedRoles();
  const result = await syncPermissions();
  console.log(
    `Permission sync: ${result.total} total, ${result.added} added, ${result.skipped} already present.`
  );
  const grants = await seedDefaultGrants();
  console.log(`Role grants: ${grants} role-permission row(s) ensured.`);
}

main()
  .then(async () => {
    const { prisma } = await import('../src/lib/dal/base/prisma.client');
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    const { prisma } = await import('../src/lib/dal/base/prisma.client');
    await prisma.$disconnect();
    process.exit(1);
  });

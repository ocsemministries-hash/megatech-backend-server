import type { Prisma, Role, RoleName } from '@prisma/client';
import { prisma } from '../../base/prisma.client';
import { BaseRepository } from '../../base/base.repository';
import type { ModelDelegate } from '../../base/base.repository.types';
import type { CreateRoleInput, UpdateRoleInput } from './role.schema';

const roleWithPermissionsInclude = {
  permissions: { include: { permission: true } },
} satisfies Prisma.RoleInclude;

export type RoleWithPermissions = Prisma.RoleGetPayload<{ include: typeof roleWithPermissionsInclude }>;

const mapWithPermissions = (role: RoleWithPermissions): Role & { permissionKeys: string[] } => ({
  ...role,
  permissionKeys: role.permissions.map((rp) => rp.permission.id),
});

export class RoleRepository extends BaseRepository<Role, CreateRoleInput, UpdateRoleInput> {
  constructor() {
    super(prisma.role as unknown as ModelDelegate<Role>);
  }

  async findByName(name: RoleName): Promise<Role | null> {
    return this.findFirst({ name });
  }

  async findByIdWithPermissions(id: string): Promise<(Role & { permissionKeys: string[] }) | null> {
    const row = await prisma.role.findUnique({ where: { id }, include: roleWithPermissionsInclude });
    return row ? mapWithPermissions(row) : null;
  }

  async listWithPermissions(): Promise<(Role & { permissionKeys: string[] })[]> {
    const rows = await prisma.role.findMany({
      include: roleWithPermissionsInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapWithPermissions);
  }

  async listWithPermissionsAndCounts(): Promise<(Role & { permissionKeys: string[]; adminCount: number })[]> {
    const rows = await prisma.role.findMany({
      include: roleWithPermissionsInclude,
      orderBy: { createdAt: 'asc' },
    });
    const counts = await prisma.admin.groupBy({ by: ['roleId'], _count: { roleId: true } });
    const countByRole = new Map(counts.map((c) => [c.roleId, c._count.roleId]));
    return rows.map((role) => ({
      ...mapWithPermissions(role),
      adminCount: role.id ? (countByRole.get(role.id) ?? 0) : 0,
    }));
  }

  async assignPermissions(roleId: string, permissionKeys: string[]): Promise<void> {
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({
        data: permissionKeys.map((permissionId) => ({ roleId, permissionId })),
      }),
    ]);
  }

  async hardDeleteRole(id: string): Promise<void> {
    await prisma.role.delete({ where: { id } });
  }
}

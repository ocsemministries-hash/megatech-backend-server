import type { Admin, Prisma } from '@prisma/client';
import { prisma } from '../../base/prisma.client';
import { BaseRepository } from '../../base/base.repository';
import type { ModelDelegate } from '../../base/base.repository.types';
import type { DbClient } from '../../base/transaction';
import type { AdminRoleShape, CreateAdminInput, UpdateAdminInput } from './admin.schema';

const adminWithRoleInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
} satisfies Prisma.AdminInclude;

export type AdminWithRole = Prisma.AdminGetPayload<{ include: typeof adminWithRoleInclude }>;

const mapWithRole = (admin: AdminWithRole): Admin & AdminRoleShape => ({
  ...admin,
  roleName: admin.role?.name ?? null,
  permissions: admin.role?.permissions.map((rp) => rp.permission.id) ?? [],
});

export class AdminRepository extends BaseRepository<Admin, CreateAdminInput, UpdateAdminInput> {
  constructor() {
    super(prisma.admin as unknown as ModelDelegate<Admin>);
  }

  async findByEmail(email: string): Promise<Admin | null> {
    return this.findFirst({ email: email.toLowerCase() });
  }

  async findByEmailWithRole(email: string): Promise<(Admin & AdminRoleShape) | null> {
    const row = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() },
      include: adminWithRoleInclude,
    });
    return row ? mapWithRole(row) : null;
  }

  async findByIdWithRole(id: string): Promise<(Admin & AdminRoleShape) | null> {
    const row = await prisma.admin.findUnique({ where: { id }, include: adminWithRoleInclude });
    return row ? mapWithRole(row) : null;
  }

  async createAdmin(data: CreateAdminInput): Promise<Admin> {
    return this.create({ ...data, email: data.email.toLowerCase() });
  }

  /** Partial admin update, joining the caller's transaction when `db` is given. */
  async updateAdmin(id: string, data: UpdateAdminInput, db: DbClient = prisma): Promise<Admin> {
    return db.admin.update({ where: { id }, data });
  }

  async setLastLogin(id: string): Promise<void> {
    await this.update(id, { lastLoginAt: new Date() } as UpdateAdminInput);
  }

  async countByStatus(status: Admin['status']): Promise<number> {
    return this.count({ status });
  }

  async countByRole(roleId: string): Promise<number> {
    return this.count({ roleId });
  }

  async list(params: {
    page?: number;
    perPage?: number;
    search?: string;
  }): Promise<{ rows: (Admin & AdminRoleShape)[]; total: number }> {
    const { page = 1, perPage = 20, search } = params;
    const where: Prisma.AdminWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [rows, total] = await prisma.$transaction([
      prisma.admin.findMany({
        where,
        include: adminWithRoleInclude,
        orderBy: { createdAt: 'desc' },
        take: perPage,
        skip: (page - 1) * perPage,
      }),
      prisma.admin.count({ where }),
    ]);

    return { rows: rows.map(mapWithRole), total };
  }
}

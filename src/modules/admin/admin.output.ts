import type { AdminStatus, RoleName } from '@prisma/client';
import type { AdminListResult } from './admin.types';
import type { AdminWithPermissions } from '@/lib/security/principal';

export interface AdminDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: AdminStatus;
  isSuperAdmin: boolean;
  roleId: string | null;
  roleName: RoleName | null;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export const toAdminDto = (admin: AdminWithPermissions): AdminDto => ({
  id: admin.id,
  firstName: admin.firstName,
  lastName: admin.lastName,
  email: admin.email,
  phone: admin.phone,
  status: admin.status,
  isSuperAdmin: admin.isSuperAdmin,
  roleId: admin.roleId,
  roleName: admin.roleName,
  permissions: admin.permissions,
  lastLoginAt: admin.lastLoginAt ? admin.lastLoginAt.toISOString() : null,
  createdAt: admin.createdAt.toISOString(),
});

export const toAdminListDto = (result: AdminListResult) => ({
  rows: result.rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    status: row.status,
    isSuperAdmin: row.isSuperAdmin,
    roleId: row.roleId,
    roleName: row.roleName,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  })),
  total: result.total,
  page: result.page,
  perPage: result.perPage,
});

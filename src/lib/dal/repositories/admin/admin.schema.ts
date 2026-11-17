import type { AdminStatus, RoleName } from '@prisma/client';

export interface CreateAdminInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  passwordHash: string;
  status?: AdminStatus;
  isSuperAdmin?: boolean;
  roleId?: string | null;
}

export interface UpdateAdminInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  status?: AdminStatus;
  roleId?: string | null;
  passwordHash?: string;
  googleSub?: string | null;
}

export interface AdminSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: AdminStatus;
  isSuperAdmin: boolean;
  roleId: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminRoleShape {
  id: string;
  roleId: string | null;
  roleName: RoleName | null;
  permissions: string[];
}

import type { AdminStatus, RoleName } from '@prisma/client';

export interface AdminListParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export interface AdminListResult {
  rows: AdminListItem[];
  total: number;
  page: number;
  perPage: number;
}

export interface AdminListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: AdminStatus;
  isSuperAdmin: boolean;
  roleId: string | null;
  roleName: RoleName | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export type { AdminStatus, RoleName };

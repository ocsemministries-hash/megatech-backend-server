import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsecases } from '@/modules/admin/admin.usecases';
import { CannotDeleteSelfError, CannotSuspendSelfError, InviteInvalidError } from '@/modules/admin/admin.errors';
import { clearCapturedMails } from '@/lib/mailer/mailer';
import type { AdminActor, AdminWithPermissions } from '@/lib/security/principal';
import type { Admin, Role } from '@prisma/client';

const makeAdmin = (overrides: Partial<AdminWithPermissions> = {}): AdminWithPermissions => ({
  id: 'admin-1',
  firstName: 'Root',
  lastName: 'Admin',
  email: 'root@megatech.org',
  phone: null,
  passwordHash: 'h',
  status: 'ACTIVE',
  isSuperAdmin: true,
  roleId: 'role-super',
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  roleName: 'SUPER_ADMIN',
  permissions: [],
  ...overrides,
});

const makeRole = (overrides: Partial<Role> = {}): Role => ({
  id: 'role-editor',
  name: 'EDITOR',
  description: 'Editor',
  isSystem: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

type Fakes = {
  admins: Record<string, ReturnType<typeof vi.fn>>;
  roles: Record<string, ReturnType<typeof vi.fn>>;
  tokens: Record<string, ReturnType<typeof vi.fn>>;
};

const buildUsecases = (fakes: Fakes): AdminUsecases =>
  new AdminUsecases(fakes.admins as never, fakes.roles as never, fakes.tokens as never);

const defaultFakes = (): Fakes => ({
  admins: {
    findByEmail: vi.fn(),
    findByIdWithRole: vi.fn(),
    findById: vi.fn(),
    createAdmin: vi.fn(),
    updateAdmin: vi.fn(),
    hardDelete: vi.fn(),
    hardDeleteMany: vi.fn(),
    list: vi.fn(),
  },
  roles: { findById: vi.fn(), findByName: vi.fn() },
  tokens: {
    createToken: vi.fn(),
    findByHash: vi.fn(),
    markConsumed: vi.fn(),
    hardDeleteMany: vi.fn(),
  },
});

const actor: AdminActor = { id: 'admin-1', email: 'root@megatech.org', firstName: 'Root', lastName: 'Admin', isSuperAdmin: true };

beforeEach(() => {
  clearCapturedMails();
});

describe('AdminUsecases.invite', () => {
  it('cannot invite into the SUPER_ADMIN role', async () => {
    const fakes = defaultFakes();
    fakes.roles.findById.mockResolvedValue(makeRole({ id: 'role-super', name: 'SUPER_ADMIN' }));
    const usecases = buildUsecases(fakes);

    await expect(
      usecases.invite(actor, { firstName: 'G', lastName: 'H', email: 'g@megatech.org', roleId: 'role-super' })
    ).rejects.toThrow('Super admins can only be managed by another super admin');
  });

  it('creates a PENDING admin and emails an invite link', async () => {
    const fakes = defaultFakes();
    fakes.roles.findById.mockResolvedValue(makeRole({}));
    fakes.admins.findByEmail.mockResolvedValue(null);
    fakes.admins.createAdmin.mockImplementation(async (data: Admin) => makeAdmin({ ...data, id: 'admin-2' }));
    fakes.admins.findByIdWithRole.mockResolvedValue(
      makeAdmin({ id: 'admin-2', email: 'grace@megatech.org', roleId: 'role-editor' })
    );
    fakes.tokens.createToken.mockResolvedValue({ id: 'invite-1' });
    const usecases = buildUsecases(fakes);

    const result = await usecases.invite(actor, {
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@megatech.org',
      roleId: 'role-editor',
    });

    expect(result.email).toBe('grace@megatech.org');
    expect(fakes.admins.createAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ isSuperAdmin: false, status: 'PENDING', roleId: 'role-editor' })
    );
    expect(fakes.tokens.createToken).toHaveBeenCalledWith(expect.objectContaining({ tokenType: 'INVITE' }));
  });
});

describe('AdminUsecases.delete', () => {
  it('refuses self-deletion', async () => {
    const fakes = defaultFakes();
    const usecases = buildUsecases(fakes);

    await expect(usecases.delete(actor, 'admin-1')).rejects.toBeInstanceOf(CannotDeleteSelfError);
  });

  it('deletes another admin and their tokens', async () => {
    const fakes = defaultFakes();
    fakes.admins.findById.mockResolvedValue(makeAdmin({ id: 'admin-2', isSuperAdmin: false }));
    fakes.admins.hardDelete.mockResolvedValue(makeAdmin({}));
    fakes.tokens.hardDeleteMany.mockResolvedValue({ count: 1 });
    const usecases = buildUsecases(fakes);

    await expect(usecases.delete(actor, 'admin-2')).resolves.toBeUndefined();
    expect(fakes.admins.hardDelete).toHaveBeenCalledWith('admin-2');
    expect(fakes.tokens.hardDeleteMany).toHaveBeenCalledWith({ adminId: 'admin-2' });
  });
});

describe('AdminUsecases.update', () => {
  it('prevents suspending your own account', async () => {
    const fakes = defaultFakes();
    fakes.admins.findById.mockResolvedValue(makeAdmin({}));
    fakes.admins.findByIdWithRole.mockResolvedValue(makeAdmin({}));
    const usecases = buildUsecases(fakes);

    await expect(usecases.update(actor, 'admin-1', { status: 'SUSPENDED' })).rejects.toBeInstanceOf(
      CannotSuspendSelfError
    );
  });
});

describe('AdminUsecases.acceptInvite', () => {
  it('rejects an invalid invite token', async () => {
    const fakes = defaultFakes();
    fakes.tokens.findByHash.mockResolvedValue(null);
    const usecases = buildUsecases(fakes);

    await expect(usecases.acceptInvite('bad-token', { password: 'password123' })).rejects.toBeInstanceOf(
      InviteInvalidError
    );
  });
});

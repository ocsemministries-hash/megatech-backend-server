import { describe, expect, it, vi } from 'vitest';
import { RbacUsecases } from '@/modules/rbac/rbac.usecases';
import { RbacPermissionInvalidError, RbacRoleNotFoundError } from '@/modules/rbac/rbac.errors';

type Fakes = {
  roles: Record<string, ReturnType<typeof vi.fn>>;
  permissions: Record<string, ReturnType<typeof vi.fn>>;
  admins: Record<string, ReturnType<typeof vi.fn>>;
};

const buildUsecases = (fakes: Fakes): RbacUsecases =>
  new RbacUsecases(fakes.roles as never, fakes.permissions as never, fakes.admins as never);

const defaultFakes = (): Fakes => ({
  roles: { listWithPermissionsAndCounts: vi.fn(), findByIdWithPermissions: vi.fn(), findById: vi.fn(), assignPermissions: vi.fn(), hardDeleteRole: vi.fn() },
  permissions: { countExistingByIds: vi.fn() },
  admins: { countByRole: vi.fn() },
});

describe('RbacUsecases', () => {
  it('lists the resource/action registry', async () => {
    const usecases = buildUsecases(defaultFakes());
    const registry = await usecases.resources();
    expect(registry.resources.length).toBeGreaterThan(0);
    expect(registry.actions).toEqual(['view', 'create', 'export', 'update', 'delete']);
  });

  it('lists roles from the role repository', async () => {
    const fakes = defaultFakes();
    fakes.roles.listWithPermissionsAndCounts.mockResolvedValue([
      { id: 'r1', name: 'VIEWER', description: 'x', isSystem: true, permissionKeys: ['accounts:view'], adminCount: 3 },
    ]);
    const usecases = buildUsecases(fakes);

    const result = await usecases.listRoles();

    expect(result.roles).toHaveLength(1);
    expect(result.roles[0]).toMatchObject({ name: 'VIEWER', adminCount: 3 });
  });

  it('throws when a role is missing', async () => {
    const fakes = defaultFakes();
    fakes.roles.findById.mockResolvedValue(null);
    const usecases = buildUsecases(fakes);

    await expect(usecases.updateRolePermissions('missing', { permissionKeys: [] })).rejects.toBeInstanceOf(
      RbacRoleNotFoundError
    );
  });

  it('rejects unknown permission keys when updating a role', async () => {
    const fakes = defaultFakes();
    fakes.roles.findById.mockResolvedValue({ id: 'r1', name: 'EDITOR' });
    fakes.permissions.countExistingByIds.mockResolvedValue(1);
    const usecases = buildUsecases(fakes);

    await expect(usecases.updateRolePermissions('r1', { permissionKeys: ['accounts:view', 'nope:view'] })).rejects.toBeInstanceOf(
      RbacPermissionInvalidError
    );
  });
});

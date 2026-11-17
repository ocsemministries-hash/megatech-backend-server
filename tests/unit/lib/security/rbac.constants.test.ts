import { describe, expect, it } from 'vitest';
import { RBAC_ACTIONS, RBAC_RESOURCES, isRbacAction, isRbacResource, permissionKey } from '@/lib/security/rbac.constants';

describe('rbac constants', () => {
  it('defines the Megatech resource registry', () => {
    expect([...RBAC_RESOURCES].sort()).toEqual(
      ['accounts', 'admins', 'audit', 'dashboard', 'profile', 'roles', 'subscribers'].sort()
    );
    expect(new Set(RBAC_RESOURCES).size).toBe(RBAC_RESOURCES.length);
    expect(new Set(RBAC_ACTIONS).size).toBe(RBAC_ACTIONS.length);
  });

  it('builds stable permission keys', () => {
    expect(permissionKey('accounts', 'update')).toBe('accounts:update');
  });

  it('guards resource/action membership', () => {
    expect(isRbacResource('accounts')).toBe(true);
    expect(isRbacResource('profile')).toBe(true);
    expect(isRbacResource('subscribers')).toBe(true);
    expect(isRbacResource('media')).toBe(false);
    expect(isRbacResource('bookings')).toBe(false);
    expect(isRbacAction('export')).toBe(true);
    expect(isRbacAction('nope')).toBe(false);
  });

  it('builds admin permission keys', () => {
    expect(permissionKey('admins', 'create')).toBe('admins:create');
    expect(permissionKey('dashboard', 'view')).toBe('dashboard:view');
  });
});

import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from '@/utils/jwt';
import type { AdminPrincipal } from '@/types/auth';

const principal: AdminPrincipal = {
  id: 'admin-1',
  email: 'root@megatech.org',
  firstName: 'Root',
  lastName: 'Admin',
  roleId: 'role-1',
  roleName: 'SUPER_ADMIN',
  isSuperAdmin: true,
  permissions: ['admins:view', 'accounts:update'],
};

describe('jwt utils', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken(principal);
    const payload = verifyAccessToken(token);
    expect(payload).toMatchObject({
      sub: 'admin-1',
      email: 'root@megatech.org',
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      permissions: ['admins:view', 'accounts:update'],
    });
  });

  it('returns null for a tampered token', () => {
    const token = signAccessToken(principal);
    expect(verifyAccessToken(`${token.slice(0, -2)}xx`)).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(verifyAccessToken('not-a-jwt')).toBeNull();
  });
});

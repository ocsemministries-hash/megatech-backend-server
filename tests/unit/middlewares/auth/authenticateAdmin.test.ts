import { describe, expect, it } from 'vitest';
import { authenticateAdmin } from '@/middlewares/auth/authenticateAdmin.middleware';
import { requireSuperAdmin } from '@/middlewares/auth/requireSuperAdmin.middleware';
import { signAccessToken } from '@/utils/jwt';
import type { AdminPrincipal } from '@/types/auth';
import { createMockNext, createMockRequest, createMockResponse } from '../../../mocks/express.mock';
import { ACCESS_COOKIE } from '@/utils/cookies';

const principal: AdminPrincipal = {
  id: 'admin-1',
  email: 'root@megatech.org',
  firstName: 'Root',
  lastName: 'Admin',
  roleId: 'role-1',
  roleName: 'SUPER_ADMIN',
  isSuperAdmin: true,
  permissions: ['roles:view'],
};

describe('authenticateAdmin middleware', () => {
  it('populates req.admin from a valid access cookie', () => {
    const req = createMockRequest({ cookies: { [ACCESS_COOKIE]: signAccessToken(principal) } });
    const res = createMockResponse();
    const next = createMockNext();

    authenticateAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.admin).toMatchObject({ id: 'admin-1', email: 'root@megatech.org', isSuperAdmin: true });
  });

  it('accepts a Bearer header fallback', () => {
    const req = createMockRequest({
      headers: { authorization: `Bearer ${signAccessToken(principal)}` },
    });
    const res = createMockResponse();
    const next = createMockNext();

    authenticateAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.admin).toBeDefined();
  });

  it('returns 401 without a token', () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = createMockNext();

    authenticateAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token', () => {
    const req = createMockRequest({ cookies: { [ACCESS_COOKIE]: 'invalid.jwt.token' } });
    const res = createMockResponse();
    const next = createMockNext();

    authenticateAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireSuperAdmin middleware', () => {
  it('allows super admins', () => {
    const req = createMockRequest({ admin: principal });
    const res = createMockResponse();
    const next = createMockNext();

    requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('forbids non-super admins', () => {
    const req = createMockRequest({ admin: { ...principal, isSuperAdmin: false } });
    const res = createMockResponse();
    const next = createMockNext();

    requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects unauthenticated requests', () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = createMockNext();

    requireSuperAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

import { describe, expect, it } from 'vitest';
import { authenticateUser } from '@/middlewares/auth/authenticateUser.middleware';
import { signUserAccessToken } from '@/utils/jwt';
import { createMockNext, createMockRequest, createMockResponse } from '../../../mocks/express.mock';
import { USER_ACCESS_COOKIE } from '@/utils/cookies';

describe('authenticateUser middleware', () => {
  it('populates req.user from a valid partner access cookie', () => {
    const token = signUserAccessToken({ id: 'user-1', email: 'sarah@example.com', firstName: 'Sarah', lastName: 'Jenkins' });
    const req = createMockRequest({ cookies: { [USER_ACCESS_COOKIE]: token } });
    const res = createMockResponse();
    const next = createMockNext();

    authenticateUser(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 'user-1', email: 'sarah@example.com' });
  });

  it('rejects admin-issuer tokens on user routes (no cross-audience reuse)', async () => {
    const { signAccessToken } = await import('@/utils/jwt');
    const adminToken = signAccessToken({
      id: 'admin-1',
      email: 'root@megatech.org',
      firstName: 'Root',
      lastName: 'Admin',
      roleId: 'role-1',
      roleName: 'SUPER_ADMIN',
      isSuperAdmin: true,
      permissions: [],
    });
    const req = createMockRequest({ cookies: { [USER_ACCESS_COOKIE]: adminToken } });
    const res = createMockResponse();
    const next = createMockNext();

    authenticateUser(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 without credentials', () => {
    const req = createMockRequest({ cookies: {} });
    const res = createMockResponse();
    const next = createMockNext();

    authenticateUser(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

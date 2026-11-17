import { describe, expect, it } from 'vitest';
import { rbac, rbacAny } from '@/middlewares/auth/authorizeRbac.middleware';
import { createMockNext, createMockRequest, createMockResponse } from '../../../mocks/express.mock';
import type { AdminPrincipal } from '@/types/auth';

const makeAdmin = (overrides: Partial<AdminPrincipal>): AdminPrincipal => ({
  id: 'a1',
  email: 'a@b.com',
  firstName: 'A',
  lastName: 'B',
  roleId: 'r1',
  roleName: 'EDITOR',
  isSuperAdmin: false,
  permissions: ['accounts:view', 'profile:update'],
  ...overrides,
});

describe('rbac middleware', () => {
  it('allows an admin holding the permission', () => {
    const req = createMockRequest({ admin: makeAdmin({}) });
    const res = createMockResponse();
    const next = createMockNext();

    rbac('accounts', 'view')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('forbids an admin without the permission', () => {
    const req = createMockRequest({ admin: makeAdmin({}) });
    const res = createMockResponse();
    const next = createMockNext();

    rbac('accounts', 'delete')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets super admins bypass every check', () => {
    const req = createMockRequest({ admin: makeAdmin({ isSuperAdmin: true, permissions: [] }) });
    const res = createMockResponse();
    const next = createMockNext();

    rbac('accounts', 'delete')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects when no admin is authenticated', () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = createMockNext();

    rbac('accounts', 'view')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('rbacAny middleware', () => {
  it('passes an admin holding the first permission', () => {
    const req = createMockRequest({ admin: makeAdmin({ permissions: ['media:create'] }) });
    const res = createMockResponse();
    const next = createMockNext();

    rbacAny(['media', 'create'], ['live', 'create'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes an admin holding only the second permission', () => {
    const req = createMockRequest({ admin: makeAdmin({ permissions: ['live:create'] }) });
    const res = createMockResponse();
    const next = createMockNext();

    rbacAny(['media', 'create'], ['live', 'create'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('forbids an admin holding neither permission', () => {
    const req = createMockRequest({ admin: makeAdmin({ permissions: ['media:view'] }) });
    const res = createMockResponse();
    const next = createMockNext();

    rbacAny(['media', 'create'], ['live', 'create'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets super admins bypass every check', () => {
    const req = createMockRequest({ admin: makeAdmin({ isSuperAdmin: true, permissions: [] }) });
    const res = createMockResponse();
    const next = createMockNext();

    rbacAny(['media', 'create'], ['live', 'create'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects when no admin is authenticated', () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = createMockNext();

    rbacAny(['media', 'create'], ['live', 'create'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

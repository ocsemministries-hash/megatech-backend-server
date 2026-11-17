import cookieParser from 'cookie-parser';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRouter } from '@/modules/admin/admin.route';
import { AdminSubscriberUsecases } from '@/modules/admin/admin.subscriber.usecases';
import { AdminNotFoundError } from '@/modules/admin/admin.errors';
import { AdminUsecases } from '@/modules/admin/admin.usecases';
import { signAccessToken } from '@/utils/jwt';
import { ADMIN_ACCESS_COOKIE } from '@/utils/cookies';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const SUBSCRIBER_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-06T12:00:00.000Z');

const superAdminCookie = (): string => {
  const token = signAccessToken({
    id: 'admin-1',
    email: 'root@megatech.io',
    firstName: 'Root',
    lastName: 'Admin',
    roleId: null,
    roleName: 'SUPER_ADMIN',
    isSuperAdmin: true,
    permissions: [],
  });
  return `${ADMIN_ACCESS_COOKIE}=${token}`;
};

const limitedCookie = (permissions: string[]): string => {
  const token = signAccessToken({
    id: 'admin-2',
    email: 'editor@megatech.io',
    firstName: 'Ed',
    lastName: 'Itor',
    roleId: 'role-editor',
    roleName: 'EDITOR',
    isSuperAdmin: false,
    permissions,
  });
  return `${ADMIN_ACCESS_COOKIE}=${token}`;
};

const makeAdmin = () => ({
  id: ADMIN_ID,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@megatech.io',
  phone: null,
  status: 'ACTIVE',
  isSuperAdmin: false,
  roleId: null,
  roleName: null,
  permissions: [],
  lastLoginAt: null,
  createdAt: NOW,
});

const makeSubscriber = () => ({
  id: SUBSCRIBER_ID,
  email: 'reader@example.com',
  name: 'Reader',
  source: 'PUBLIC',
  userId: null,
  status: 'ACTIVE',
  unsubscribeToken: 'token-1',
  subscribedAt: NOW,
  unsubscribedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
});

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/admin', adminRouter());
  app.use((err: { statusCode?: number; message?: string }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode ?? 500).json({ success: false, error: err.message ?? 'Internal Server Error' });
  });
  return app;
};

beforeEach(() => {
  vi.spyOn(AdminUsecases.prototype, 'list').mockResolvedValue({
    rows: [makeAdmin()],
    total: 1,
    page: 1,
    perPage: 20,
  } as never);
  vi.spyOn(AdminUsecases.prototype, 'getById').mockResolvedValue(makeAdmin() as never);
  vi.spyOn(AdminUsecases.prototype, 'delete').mockResolvedValue(undefined);
  vi.spyOn(AdminSubscriberUsecases.prototype, 'list').mockResolvedValue({
    rows: [makeSubscriber()],
    total: 1,
    page: 1,
    perPage: 20,
    counts: { ACTIVE: 1, UNSUBSCRIBED: 0 },
  } as never);
});

describe('admin route auth guards', () => {
  it('returns 401 without a credential', async () => {
    const response = await request(buildApp()).get('/api/v1/admin/admins');

    expect(response.status).toBe(401);
    expect(AdminUsecases.prototype.list).not.toHaveBeenCalled();
  });

  it('returns 403 when admins:view is missing', async () => {
    const response = await request(buildApp())
      .get('/api/v1/admin/admins')
      .set('Cookie', limitedCookie(['subscribers:view']));

    expect(response.status).toBe(403);
    expect(AdminUsecases.prototype.list).not.toHaveBeenCalled();
  });
});

describe('admin management routes', () => {
  it('serves the admin list with rows and total', async () => {
    const response = await request(buildApp()).get('/api/v1/admin/admins').set('Cookie', superAdminCookie());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { total: 1 } });
    expect(response.body.data.rows[0].email).toBe('ada@megatech.io');
  });

  it('returns 400 for a non-uuid admin id without touching the usecase', async () => {
    const response = await request(buildApp()).get('/api/v1/admin/admins/not-a-uuid').set('Cookie', superAdminCookie());

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(AdminUsecases.prototype.getById).not.toHaveBeenCalled();
  });

  it('maps a missing admin to 404', async () => {
    vi.spyOn(AdminUsecases.prototype, 'getById').mockRejectedValue(new AdminNotFoundError());

    const response = await request(buildApp()).get(`/api/v1/admin/admins/${ADMIN_ID}`).set('Cookie', superAdminCookie());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, error: 'Admin not found' });
  });

  it('deletes with a confirmation message', async () => {
    const response = await request(buildApp()).delete(`/api/v1/admin/admins/${ADMIN_ID}`).set('Cookie', superAdminCookie());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, message: 'Admin deleted' });
  });
});

describe('admin subscriber routes', () => {
  it('serves the subscriber list with rows and tab counts', async () => {
    const response = await request(buildApp()).get('/api/v1/admin/subscribers').set('Cookie', superAdminCookie());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { total: 1, counts: { ACTIVE: 1 } } });
  });

  it('rejects an invalid status filter with 400', async () => {
    const response = await request(buildApp())
      .get('/api/v1/admin/subscribers?status=NOPE')
      .set('Cookie', superAdminCookie());

    expect(response.status).toBe(400);
    expect(AdminSubscriberUsecases.prototype.list).not.toHaveBeenCalled();
  });
});

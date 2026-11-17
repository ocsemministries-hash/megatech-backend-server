import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

/**
 * End-to-end admin auth flow against a real Postgres instance.
 *
 * Requires a test database. Set TEST_DATABASE_URL in your environment, then run
 * migrations + seed against it:
 *   DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
 *   DATABASE_URL=$TEST_DATABASE_URL npm run prisma:seed
 *
 * When TEST_DATABASE_URL is absent the whole suite is skipped so `npm test`
 * stays green on machines without Postgres.
 */
const testDbUrl = process.env.TEST_DATABASE_URL;
const EMAIL = 'root@megatech.org';

describe.skipIf(!testDbUrl)('Admin auth flow (DB)', () => {
  let app: Parameters<typeof request>[0];
  let prisma: { admin: { deleteMany: (a: unknown) => Promise<unknown> }; verificationToken: { deleteMany: (a: unknown) => Promise<unknown> } };
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDbUrl;
    const appModule = await import('@/app');
    const prismaModule = await import('@/lib/dal/base/prisma.client');
    app = appModule.default;
    prisma = prismaModule.prisma as never;
    agent = request.agent(app);

    // Fresh state for a repeatable run.
    await prisma.verificationToken.deleteMany({ where: { admin: { email: EMAIL } } });
    await prisma.admin.deleteMany({ where: { email: EMAIL } });
  });

  afterAll(async () => {
    await prisma.admin.deleteMany({ where: { email: EMAIL } });
    await (prisma as { $disconnect: () => Promise<void> }).$disconnect();
  });

  const extractLatestOtp = (): string => {
    const captured = require('@/lib/mailer/mailer').getCapturedMails() as { html: string }[];
    const last = captured[captured.length - 1];
    const match = last.html.match(/(\d{6})/);
    expect(match).not.toBeNull();
    return match![1];
  };

  it('registers, verifies, logs in with MFA, refreshes and logs out', async () => {
    const { clearCapturedMails } = await import('@/lib/mailer/mailer');
    clearCapturedMails();

    // 1. register (email must be in ADMIN_MAILS)
    const register = await agent.post('/api/v1/admin/auth/register').send({
      firstName: 'Root',
      lastName: 'Admin',
      email: EMAIL,
      password: 'password123',
    });
    expect(register.status).toBe(201);

    // 2. verify email with OTP
    const verify = await agent.post('/api/v1/admin/auth/verify-email').send({
      email: EMAIL,
      otp: extractLatestOtp(),
    });
    expect(verify.status).toBe(200);
    expect(verify.body.data.admin.status).toBe('ACTIVE');

    // 3. login -> MFA otp
    const login = await agent.post('/api/v1/admin/auth/login').send({ email: EMAIL, password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.data.requiresOtp).toBe(true);

    // 4. confirm otp -> session + httpOnly cookies
    const otp = await agent.post('/api/v1/admin/auth/otp').send({ email: EMAIL, otp: extractLatestOtp() });
    expect(otp.status).toBe(200);
    expect(otp.headers['set-cookie']?.some((c: string) => c.includes('megatech_access'))).toBe(true);

    // 5. me
    const me = await agent.get('/api/v1/admin/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.admin.email).toBe(EMAIL);
    expect(me.body.data.admin.permissions).toBeInstanceOf(Array);

    // 6. refresh rotates cookies
    const refresh = await agent.post('/api/v1/admin/auth/refresh');
    expect(refresh.status).toBe(200);
    expect(refresh.headers['set-cookie']?.some((c: string) => c.includes('megatech_access'))).toBe(true);

    // 7. logout clears cookies
    const logout = await agent.post('/api/v1/admin/auth/logout');
    expect(logout.status).toBe(200);
    expect(logout.headers['set-cookie']?.some((c: string) => c.includes('megatech_access=;'))).toBe(true);

    // 8. access now denied
    const afterLogout = await agent.get('/api/v1/admin/auth/me');
    expect(afterLogout.status).toBe(401);
  });
});

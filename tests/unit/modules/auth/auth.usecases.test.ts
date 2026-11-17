import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthUsecases } from '@/modules/auth/auth.usecases';
import { hashPassword } from '@/utils/password';
import { hashToken } from '@/utils/tokens';
import {
  AccountAlreadyExistsError,
  InvalidCredentialsError,
  InvalidOtpError,
  RegistrationNotAllowedError,
} from '@/modules/auth/auth.errors';
import type { AdminWithPermissions } from '@/lib/security/principal';
import { clearCapturedMails, getCapturedMails } from '@/lib/mailer/mailer';
import type { Admin } from '@prisma/client';
import type { VerificationToken } from '@prisma/client';

const makeAdmin = (overrides: Partial<AdminWithPermissions> = {}): AdminWithPermissions => ({
  id: 'admin-1',
  firstName: 'Root',
  lastName: 'Admin',
  email: 'root@megatech.org',
  phone: null,
  passwordHash: 'hash',
  status: 'ACTIVE',
  isSuperAdmin: true,
  roleId: 'role-super',
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  roleName: 'SUPER_ADMIN',
  permissions: ['admins:view'],
  ...overrides,
});

type TokenOverrides = Partial<VerificationToken>;

const makeToken = (overrides: TokenOverrides = {}): VerificationToken => ({
  id: 'tok-1',
  tokenType: 'OTP',
  channel: 'EMAIL',
  adminId: 'admin-1',
  userId: null,
  identifier: 'root@megatech.org',
  tokenHash: hashToken('123456'),
  payload: null,
  expiresAt: new Date(Date.now() + 60_000),
  consumedAt: null,
  failedAttempts: 0,
  createdAt: new Date(),
  ...overrides,
});

type Fakes = {
  admins: Record<string, ReturnType<typeof vi.fn>>;
  roles: Record<string, ReturnType<typeof vi.fn>>;
  tokens: Record<string, ReturnType<typeof vi.fn>>;
};

const buildUsecases = (fakes: Fakes): AuthUsecases =>
  new AuthUsecases(fakes.admins as never, fakes.roles as never, fakes.tokens as never);

const defaultFakes = (): Fakes => ({
  admins: {
    findByEmailWithRole: vi.fn(),
    findByEmail: vi.fn(),
    findByIdWithRole: vi.fn(),
    findById: vi.fn(),
    createAdmin: vi.fn(),
    updateAdmin: vi.fn(),
    setLastLogin: vi.fn(),
  },
  roles: { findByName: vi.fn() },
  tokens: {
    deactivateActive: vi.fn(),
    createToken: vi.fn(),
    findActive: vi.fn(),
    findByHash: vi.fn(),
    markConsumed: vi.fn(),
    incrementFailedAttempts: vi.fn(),
  },
});

beforeEach(() => {
  clearCapturedMails();
});

describe('AuthUsecases.register', () => {
  it('rejects emails outside ADMIN_MAILS', async () => {
    const fakes = defaultFakes();
    const usecases = buildUsecases(fakes);

    await expect(
      usecases.register({ firstName: 'X', lastName: 'Y', email: 'x@y.com', password: 'password123' })
    ).rejects.toBeInstanceOf(RegistrationNotAllowedError);
  });

  it('rejects when the account already exists', async () => {
    const fakes = defaultFakes();
    fakes.admins.findByEmail.mockResolvedValue(makeAdmin({}));
    const usecases = buildUsecases(fakes);

    await expect(
      usecases.register({ firstName: 'Root', lastName: 'Admin', email: 'root@megatech.org', password: 'password123' })
    ).rejects.toBeInstanceOf(AccountAlreadyExistsError);
  });

  it('creates a PENDING super admin and issues a verification OTP email', async () => {
    const fakes = defaultFakes();
    fakes.roles.findByName.mockResolvedValue({ id: 'role-super', name: 'SUPER_ADMIN' });
    fakes.admins.findByEmail.mockResolvedValue(null);
    fakes.admins.createAdmin.mockImplementation(async (data: Admin) => ({ ...makeAdmin(), passwordHash: data.passwordHash }));
    fakes.admins.findByIdWithRole.mockResolvedValue(makeAdmin({}));
    const usecases = buildUsecases(fakes);

    const result = await usecases.register({
      firstName: 'Root',
      lastName: 'Admin',
      email: 'root@megatech.org',
      password: 'password123',
    });

    expect(result.admin.isSuperAdmin).toBe(true);
    expect(fakes.admins.createAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ isSuperAdmin: true, status: 'PENDING', roleId: 'role-super' })
    );
    expect(fakes.tokens.deactivateActive).toHaveBeenCalledWith('VERIFY_EMAIL', 'root@megatech.org');
    expect(fakes.tokens.createToken).toHaveBeenCalled();
  });
});

describe('AuthUsecases.login + verifyOtp', () => {
  it('rejects bad credentials', async () => {
    const fakes = defaultFakes();
    fakes.admins.findByEmailWithRole.mockResolvedValue(makeAdmin({}));
    const usecases = buildUsecases(fakes);

    await expect(usecases.login({ email: 'root@megatech.org', password: 'wrong' })).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
  });

  it('issues an MFA otp for an active admin with the right password', async () => {
    const passwordHash = await hashPassword('password123');
    const fakes = defaultFakes();
    fakes.admins.findByEmailWithRole.mockResolvedValue(makeAdmin({ passwordHash }));
    const usecases = buildUsecases(fakes);

    const result = await usecases.login({ email: 'root@megatech.org', password: 'password123' });

    expect(result.expiresInMinutes).toBe(10);
    expect(fakes.tokens.deactivateActive).toHaveBeenCalledWith('OTP', 'root@megatech.org');
    expect(fakes.tokens.createToken).toHaveBeenCalled();
  });

  it('returns a session after confirming the OTP', async () => {
    const fakes = defaultFakes();
    fakes.admins.findByEmailWithRole.mockResolvedValue(makeAdmin({}));
    fakes.tokens.findActive.mockResolvedValue(makeToken({}));
    fakes.tokens.createToken.mockResolvedValue({ id: 'new-refresh' });
    const usecases = buildUsecases(fakes);

    const session = await usecases.verifyOtp({ email: 'root@megatech.org', otp: '123456' });

    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(session.admin.email).toBe('root@megatech.org');
    expect(fakes.tokens.markConsumed).toHaveBeenCalledWith('tok-1');
    expect(fakes.admins.setLastLogin).toHaveBeenCalledWith('admin-1');
  });

  it('throws when the OTP is wrong and counts the attempt', async () => {
    const fakes = defaultFakes();
    fakes.admins.findByEmailWithRole.mockResolvedValue(makeAdmin({}));
    fakes.tokens.findActive.mockResolvedValue(makeToken({ tokenHash: hashToken('000000') }));
    const usecases = buildUsecases(fakes);

    await expect(usecases.verifyOtp({ email: 'root@megatech.org', otp: '123456' })).rejects.toBeInstanceOf(
      InvalidOtpError
    );
    expect(fakes.tokens.incrementFailedAttempts).toHaveBeenCalledWith('tok-1');
  });
});

describe('AuthUsecases.forgotPassword + resetPassword', () => {
  it('resolves generically and issues no code for an unknown email', async () => {
    const fakes = defaultFakes();
    fakes.admins.findByEmailWithRole.mockResolvedValue(null);
    const usecases = buildUsecases(fakes);

    const result = await usecases.forgotPassword({ email: 'nobody@megatech.org' });

    expect(result.otpSent).toBe(false);
    expect(fakes.tokens.createToken).not.toHaveBeenCalled();
  });

  it('issues a RESET_PASSWORD otp for an active admin', async () => {
    const fakes = defaultFakes();
    fakes.admins.findByEmailWithRole.mockResolvedValue(makeAdmin({}));
    const usecases = buildUsecases(fakes);

    await usecases.forgotPassword({ email: 'root@megatech.org' });

    expect(fakes.tokens.deactivateActive).toHaveBeenCalledWith('RESET_PASSWORD', 'root@megatech.org');
    expect(fakes.tokens.createToken).toHaveBeenCalledWith(
      expect.objectContaining({ tokenType: 'RESET_PASSWORD' })
    );
    const mails = getCapturedMails();
    expect(mails.at(-1)?.template).toBe('resetPasswordMailTemp');
  });

  it('sets a new password and revokes refresh tokens on a valid reset', async () => {
    const fakes = defaultFakes();
    fakes.admins.findByEmailWithRole.mockResolvedValue(makeAdmin({}));
    fakes.tokens.findActive.mockResolvedValue(makeToken({ tokenType: 'RESET_PASSWORD' }));
    const usecases = buildUsecases(fakes);

    await usecases.resetPassword({
      email: 'root@megatech.org',
      otp: '123456',
      newPassword: 'brand-new-password',
    });

    expect(fakes.tokens.markConsumed).toHaveBeenCalledWith('tok-1');
    expect(fakes.admins.updateAdmin).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({ passwordHash: expect.any(String) })
    );
    expect(fakes.tokens.deactivateActive).toHaveBeenCalledWith('REFRESH', 'root@megatech.org');
  });

  it('rejects a reset with the wrong code', async () => {
    const fakes = defaultFakes();
    fakes.admins.findByEmailWithRole.mockResolvedValue(makeAdmin({}));
    fakes.tokens.findActive.mockResolvedValue(
      makeToken({ tokenType: 'RESET_PASSWORD', tokenHash: hashToken('000000') })
    );
    const usecases = buildUsecases(fakes);

    await expect(
      usecases.resetPassword({ email: 'root@megatech.org', otp: '123456', newPassword: 'brand-new-password' })
    ).rejects.toBeInstanceOf(InvalidOtpError);
    expect(fakes.admins.updateAdmin).not.toHaveBeenCalled();
  });
});

describe('AuthUsecases.refresh', () => {
  it('rotates an active refresh token', async () => {
    const fakes = defaultFakes();
    fakes.tokens.findByHash.mockResolvedValue(
      makeToken({ tokenType: 'REFRESH', expiresAt: new Date(Date.now() + 60_000) })
    );
    fakes.admins.findByIdWithRole.mockResolvedValue(makeAdmin({}));
    fakes.tokens.createToken.mockResolvedValue({ id: 'rotated' });
    const usecases = buildUsecases(fakes);

    const session = await usecases.refresh('raw-refresh');

    expect(session.refreshToken).not.toBe('raw-refresh');
    expect(session.admin.email).toBe('root@megatech.org');
    expect(fakes.tokens.markConsumed).toHaveBeenCalledWith('tok-1');
    expect(fakes.tokens.createToken).toHaveBeenCalledWith(expect.objectContaining({ tokenType: 'REFRESH' }));
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserAuthUsecases } from '@/modules/userAuth/userAuth.usecases';
import { hashPassword } from '@/utils/password';
import { hashToken } from '@/utils/tokens';
import {
  AccountAlreadyExistsError,
  AccountInactiveError,
  GoogleAccountError,
  InvalidCredentialsError,
  InvalidOtpError,
  InvalidTokenError,
} from '@/modules/userAuth/userAuth.errors';
import type { User } from '@prisma/client';
import type { VerificationToken } from '@prisma/client';

vi.mock('@/utils/google', () => ({
  verifyGoogleIdToken: vi.fn(),
}));

import { verifyGoogleIdToken } from '@/utils/google';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  firstName: 'Sarah',
  lastName: 'Jenkins',
  email: 'sarah@example.com',
  phone: null,
  passwordHash: 'hash',
  googleSub: null,
  loginOtpEnabled: false,
  status: 'ACTIVE',
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const makeToken = (overrides: Partial<VerificationToken> = {}): VerificationToken => ({
  id: 'tok-1',
  tokenType: 'OTP',
  channel: 'EMAIL',
  adminId: null,
  userId: 'user-1',
  identifier: 'sarah@example.com',
  tokenHash: hashToken('123456'),
  payload: null,
  expiresAt: new Date(Date.now() + 60_000),
  consumedAt: null,
  failedAttempts: 0,
  createdAt: new Date(),
  ...overrides,
});

const defaultFakes = () => ({
  users: {
    findByEmail: vi.fn(),
    findByGoogleSub: vi.fn(),
    findById: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    setLastLogin: vi.fn(),
  },
  tokens: {
    deactivateActive: vi.fn(),
    createToken: vi.fn(),
    findActive: vi.fn(),
    findByHash: vi.fn(),
    markConsumed: vi.fn(),
    incrementFailedAttempts: vi.fn(),
  },
});

type Fakes = ReturnType<typeof defaultFakes>;

const buildUsecases = (fakes: Fakes): UserAuthUsecases =>
  new UserAuthUsecases(fakes.users as never, fakes.tokens as never);

describe('UserAuthUsecases', () => {
  let fakes: Fakes;

  beforeEach(() => {
    fakes = defaultFakes();
  });

  it('registers an open account and issues a verify-email OTP', async () => {
    fakes.users.findByEmail.mockResolvedValue(null);
    fakes.users.createUser.mockImplementation(async (data: Record<string, unknown>) => makeUser({ ...(data as Partial<User>), status: 'PENDING' }));
    const usecases = buildUsecases(fakes);

    const { user } = await usecases.register({ firstName: 'Sarah', lastName: 'Jenkins', email: 'sarah@example.com', password: 'password123' });

    expect(user.status).toBe('PENDING');
    expect(fakes.tokens.createToken).toHaveBeenCalledWith(expect.objectContaining({ tokenType: 'VERIFY_EMAIL', userId: user.id }));
  });

  it('rejects duplicate registration', async () => {
    fakes.users.findByEmail.mockResolvedValue(makeUser());
    await expect(buildUsecases(fakes).register({ firstName: 'S', lastName: 'J', email: 'sarah@example.com', password: 'password123' })).rejects.toBeInstanceOf(AccountAlreadyExistsError);
  });

  it('verifies email and activates the account', async () => {
    const pending = makeUser({ status: 'PENDING' });
    fakes.users.findByEmail.mockResolvedValue(pending);
    fakes.tokens.findActive.mockResolvedValue(makeToken({ tokenType: 'VERIFY_EMAIL' }));
    fakes.users.updateUser.mockResolvedValue({ ...pending, status: 'ACTIVE' });

    const { user } = await buildUsecases(fakes).verifyEmail({ email: pending.email, otp: '123456' });

    expect(user.status).toBe('ACTIVE');
    expect(fakes.tokens.markConsumed).toHaveBeenCalledWith('tok-1');
  });

  it('login checks the password then issues an MFA OTP (no session yet)', async () => {
    const hash = await hashPassword('password123');
    fakes.users.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash, loginOtpEnabled: true }));

    const result = await buildUsecases(fakes).login({ email: 'sarah@example.com', password: 'password123' });

    expect(result.otpSent).toBe(true);
    expect(fakes.tokens.createToken).toHaveBeenCalledWith(expect.objectContaining({ tokenType: 'OTP' }));
  });

  it('login returns a session directly when OTP is not opted in', async () => {
    const hash = await hashPassword('password123');
    fakes.users.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));
    fakes.tokens.createToken.mockResolvedValue(makeToken({ tokenType: 'REFRESH' }));

    const result = await buildUsecases(fakes).login({ email: 'sarah@example.com', password: 'password123' });

    expect(result.requiresOtp).toBe(false);
    expect(fakes.users.setLastLogin).toHaveBeenCalledWith('user-1');
  });

  it('login rejects bad passwords and unknown emails identically', async () => {
    fakes.users.findByEmail.mockResolvedValue(null);
    await expect(buildUsecases(fakes).login({ email: 'nobody@example.com', password: 'x' })).rejects.toBeInstanceOf(InvalidCredentialsError);

    const hash = await hashPassword('password123');
    fakes.users.findByEmail.mockResolvedValue(makeUser({ passwordHash: hash }));
    await expect(buildUsecases(fakes).login({ email: 'sarah@example.com', password: 'wrong' })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('verifyOtp consumes the code and returns a session', async () => {
    fakes.users.findByEmail.mockResolvedValue(makeUser());
    fakes.tokens.findActive.mockResolvedValue(makeToken());

    const session = await buildUsecases(fakes).verifyOtp({ email: 'sarah@example.com', otp: '123456' });

    expect(session.user.email).toBe('sarah@example.com');
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(fakes.users.setLastLogin).toHaveBeenCalledWith('user-1');
  });

  it('verifyOtp rejects a wrong code and counts the attempt', async () => {
    fakes.users.findByEmail.mockResolvedValue(makeUser());
    fakes.tokens.findActive.mockResolvedValue(makeToken());

    await expect(buildUsecases(fakes).verifyOtp({ email: 'sarah@example.com', otp: '000000' })).rejects.toBeInstanceOf(InvalidOtpError);
    expect(fakes.tokens.incrementFailedAttempts).toHaveBeenCalledWith('tok-1');
  });

  it('refresh rotates single-use tokens and rejects reuse', async () => {
    const user = makeUser();
    fakes.tokens.findByHash.mockResolvedValue(makeToken({ tokenType: 'REFRESH' }));
    fakes.users.findById.mockResolvedValue(user);

    const first = await buildUsecases(fakes).refresh('raw-token');
    expect(fakes.tokens.markConsumed).toHaveBeenCalledWith('tok-1');
    expect(first.refreshToken).toBeTruthy();

    fakes.tokens.findByHash.mockResolvedValue(makeToken({ tokenType: 'REFRESH', consumedAt: new Date() }));
    await expect(buildUsecases(fakes).refresh('raw-token')).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('refresh rejects tokens for inactive accounts', async () => {
    fakes.tokens.findByHash.mockResolvedValue(makeToken({ tokenType: 'REFRESH' }));
    fakes.users.findById.mockResolvedValue(makeUser({ status: 'SUSPENDED' }));
    await expect(buildUsecases(fakes).refresh('raw')).rejects.toBeInstanceOf(AccountInactiveError);
  });

  it('logout consumes the presented refresh token', async () => {
    fakes.tokens.findByHash.mockResolvedValue(makeToken({ tokenType: 'REFRESH' }));
    await buildUsecases(fakes).logout('raw');
    expect(fakes.tokens.markConsumed).toHaveBeenCalledWith('tok-1');
  });

  it('googleSignIn auto-provisions an ACTIVE account for new identities', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      googleSub: 'g-1',
      email: 'new@example.com',
      emailVerified: true,
      firstName: 'New',
      lastName: 'User',
    });
    fakes.users.findByGoogleSub.mockResolvedValue(null);
    fakes.users.findByEmail.mockResolvedValue(null);
    fakes.users.createUser.mockImplementation(async (data: Record<string, unknown>) => makeUser({ ...(data as Partial<User>), email: 'new@example.com', googleSub: 'g-1', passwordHash: null, status: 'ACTIVE' }));

    const session = await buildUsecases(fakes).googleSignIn({ idToken: 'tok' });

    expect(session.user.status).toBe('ACTIVE');
    expect(session.accessToken).toBeTruthy();
  });

  it('googleSignIn links by verified email to an existing ACTIVE account', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      googleSub: 'g-2',
      email: 'sarah@example.com',
      emailVerified: true,
      firstName: 'Sarah',
      lastName: 'Jenkins',
    });
    const existing = makeUser();
    fakes.users.findByGoogleSub.mockResolvedValue(null);
    fakes.users.findByEmail.mockResolvedValue(existing);
    fakes.users.updateUser.mockResolvedValue({ ...existing, googleSub: 'g-2' });

    const session = await buildUsecases(fakes).googleSignIn({ idToken: 'tok' });

    expect(fakes.users.updateUser).toHaveBeenCalledWith('user-1', { googleSub: 'g-2' });
    expect(session.accessToken).toBeTruthy();
  });

  it('googleSignIn rejects invalid credentials', async () => {
    vi.mocked(verifyGoogleIdToken).mockRejectedValue(new Error('bad token'));
    await expect(buildUsecases(fakes).googleSignIn({ idToken: 'bad' })).rejects.toBeInstanceOf(GoogleAccountError);
  });
});

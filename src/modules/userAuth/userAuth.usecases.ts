import type { User } from '@prisma/client';
import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { hashPassword, verifyPassword } from '@/utils/password';
import { generateOtp } from '@/utils/otp';
import { generateOpaqueToken, hashToken } from '@/utils/tokens';
import { signUserAccessToken } from '@/utils/jwt';
import { verifyGoogleIdToken } from '@/utils/google';
import { UserRepository } from '@/lib/dal/repositories/user/user.repository';
import { VerificationTokenRepository } from '@/lib/dal/repositories/verificationToken/verificationToken.repository';
import { eventBus } from '@/lib/events/event-bus';
import { USER_AUTH_EVENTS } from './userAuth.events';
import type { UserOtpMailRequestedPayload, UserWelcomeMailRequestedPayload } from './userAuth.events';
import { recordAudit } from '@/modules/audit/audit.events';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  GoogleSignInInput,
  LoginInput,
  OtpIssuedResult,
  PasswordLoginResult,
  RegisterInput,
  ResendOtpInput,
  ResetPasswordInput,
  UserSession,
  VerifyEmailInput,
  VerifyOtpInput,
} from './userAuth.types';
import {
  AccountAlreadyExistsError,
  AccountInactiveError,
  AccountNotVerifiedError,
  GoogleAccountError,
  InvalidCredentialsError,
  InvalidOtpError,
  InvalidTokenError,
  OtpMaxAttemptsError,
  PasswordLoginRequiredError,
} from './userAuth.errors';

type OtpTokenType = 'OTP' | 'VERIFY_EMAIL' | 'RESET_PASSWORD';

export class UserAuthUsecases {
  constructor(
    private readonly users: UserRepository = new UserRepository(),
    private readonly tokens: VerificationTokenRepository = new VerificationTokenRepository(),
  ) {}

  private static otpExpiry(): Date {
    return new Date(Date.now() + ENV.OTP_TTL_MINUTES * 60 * 1000);
  }

  private static refreshExpiry(): Date {
    return new Date(Date.now() + ENV.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  /**
   * Issues an OTP (of the given token type) for a user and hands the email to
   * the background event bus. Any previously active OTP of the same type is
   * invalidated (single-active).
   */
  private async issueOtp(user: Pick<User, 'id' | 'email' | 'firstName'>, tokenType: OtpTokenType): Promise<OtpIssuedResult> {
    try {
      const otp = generateOtp(6);
      const expiresAt = UserAuthUsecases.otpExpiry();

      await this.tokens.deactivateActive(tokenType, user.email);
      await this.tokens.createToken({
        tokenType,
        channel: 'EMAIL',
        userId: user.id,
        identifier: user.email,
        tokenHash: hashToken(otp),
        expiresAt,
      });

      eventBus.safeEmit<UserOtpMailRequestedPayload>(USER_AUTH_EVENTS.OTP_MAIL_REQUESTED, {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        otp,
        tokenType,
        expiresInMinutes: ENV.OTP_TTL_MINUTES,
      });

      return { otpSent: true, expiresInMinutes: ENV.OTP_TTL_MINUTES };
    } catch (error) {
      logger.error(`[user-auth] failed to issue OTP for ${user.email} (type: ${tokenType}):`, error);
      throw error;
    }
  }

  /** Verify + consume an OTP, enforcing attempt limits. */
  private async consumeOtp(email: string, otp: string, tokenType: OtpTokenType): Promise<void> {
    try {
      const token = await this.tokens.findActive(tokenType, email);
      if (!token) {
        logger.warn(`[user-auth] active OTP token not found for ${email} (type: ${tokenType})`);
        throw new InvalidOtpError();
      }

      if (token.failedAttempts >= ENV.OTP_MAX_ATTEMPTS) {
        logger.warn(`[user-auth] max OTP attempts reached for ${email} (type: ${tokenType})`);
        throw new OtpMaxAttemptsError();
      }

      if (hashToken(otp) !== token.tokenHash) {
        await this.tokens.incrementFailedAttempts(token.id);
        logger.warn(`[user-auth] invalid OTP attempt for ${email} (failed attempt ${token.failedAttempts + 1}/${ENV.OTP_MAX_ATTEMPTS})`);
        throw new InvalidOtpError();
      }

      await this.tokens.markConsumed(token.id);
    } catch (error) {
      if (!(error instanceof InvalidOtpError) && !(error instanceof OtpMaxAttemptsError)) {
        logger.error(`[user-auth] unexpected error during OTP consumption for ${email}:`, error);
      }
      throw error;
    }
  }

  /** Issue a refresh-token row and return its raw value. */
  private async issueRefreshToken(user: User): Promise<string> {
    try {
      const raw = generateOpaqueToken();
      await this.tokens.createToken({
        tokenType: 'REFRESH',
        userId: user.id,
        identifier: user.email,
        tokenHash: hashToken(raw),
        expiresAt: UserAuthUsecases.refreshExpiry(),
      });
      return raw;
    } catch (error) {
      logger.error(`[user-auth] failed to issue refresh token for ${user.email}:`, error);
      throw error;
    }
  }

  private sessionFor(user: User, refreshToken: string): UserSession {
    const accessToken = signUserAccessToken({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
    return { user, accessToken, refreshToken };
  }

  /** Open partner registration — no allowlist. New accounts start PENDING. */
  async register(input: RegisterInput): Promise<{ user: User }> {
    try {
      const existing = await this.users.findByEmail(input.email);
      if (existing) {
        logger.warn(`[user-auth] registration failed: account already exists for ${input.email}`);
        throw new AccountAlreadyExistsError();
      }

      const passwordHash = await hashPassword(input.password);
      const user = await this.users.createUser({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        status: 'PENDING',
      });

      await this.issueOtp(user, 'VERIFY_EMAIL');
      logger.info(`[user-auth] registration initiated for ${user.email}`);

      recordAudit({
        action: 'user_auth.registered',
        actorId: user.id,
        resource: `user:${user.id}`,
        meta: { email: user.email },
      });
      return { user };
    } catch (error) {
      if (!(error instanceof AccountAlreadyExistsError)) {
        logger.error(`[user-auth] registration error for ${input.email}:`, error);
      }
      throw error;
    }
  }

  async verifyEmail(input: VerifyEmailInput): Promise<{ user: User }> {
    try {
      const user = await this.users.findByEmail(input.email);
      if (!user) {
        logger.warn(`[user-auth] email verification failed: user ${input.email} not found`);
        throw new InvalidCredentialsError();
      }

      await this.consumeOtp(user.email, input.otp, 'VERIFY_EMAIL');

      const updated = await this.users.updateUser(user.id, { status: 'ACTIVE' });

      eventBus.safeEmit<UserWelcomeMailRequestedPayload>(USER_AUTH_EVENTS.WELCOME_MAIL_REQUESTED, {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
      });
      recordAudit({
        action: 'user_auth.email_verified',
        actorId: user.id,
        resource: `user:${user.id}`,
        meta: { email: user.email },
      });

      logger.info(`[user-auth] user ${user.email} verified successfully`);
      return { user: updated };
    } catch (error) {
      if (!(error instanceof InvalidCredentialsError) && !(error instanceof InvalidOtpError) && !(error instanceof OtpMaxAttemptsError)) {
        logger.error(`[user-auth] verifyEmail error for ${input.email}:`, error);
      }
      throw error;
    }
  }

  /** Step 1 — password check, then MFA OTP. Google-only accounts must use Google. */
  async login(input: LoginInput): Promise<PasswordLoginResult> {
    try {
      const user = await this.users.findByEmail(input.email);
      if (!user) {
        logger.warn(`[user-auth] login failed: unknown email ${input.email}`);
        throw new InvalidCredentialsError();
      }

      if (!user.passwordHash) {
        logger.warn(`[user-auth] login rejected: Google-only account ${input.email}`);
        throw new PasswordLoginRequiredError();
      }

      const ok = await verifyPassword(input.password, user.passwordHash);
      if (!ok) {
        logger.warn(`[user-auth] login failed: invalid credentials for ${input.email}`);
        throw new InvalidCredentialsError();
      }

      if (user.status === 'PENDING') {
        logger.warn(`[user-auth] login blocked: account ${input.email} is pending verification`);
        throw new AccountNotVerifiedError();
      }

      if (user.status !== 'ACTIVE') {
        logger.warn(`[user-auth] login blocked: account ${input.email} is inactive/suspended`);
        throw new AccountInactiveError();
      }

      if (user.loginOtpEnabled) {
        logger.info(`[user-auth] password verified for ${user.email}, issuing opted-in login OTP`);
        return { requiresOtp: true, ...(await this.issueOtp(user, 'OTP')) };
      }

      await this.users.setLastLogin(user.id);
      recordAudit({ action: 'user_auth.login.succeeded', actorId: user.id, resource: `user:${user.id}`, meta: { email: user.email, method: 'password' } });
      const refreshToken = await this.issueRefreshToken(user);
      return { requiresOtp: false, session: this.sessionFor(user, refreshToken) };
    } catch (error) {
      if (
        !(error instanceof InvalidCredentialsError) &&
        !(error instanceof PasswordLoginRequiredError) &&
        !(error instanceof AccountNotVerifiedError) &&
        !(error instanceof AccountInactiveError)
      ) {
        logger.error(`[user-auth] login error for ${input.email}:`, error);
      }
      throw error;
    }
  }

  /** Step 2 — consume MFA OTP and create the session. */
  async verifyOtp(input: VerifyOtpInput): Promise<UserSession> {
    try {
      const user = await this.users.findByEmail(input.email);
      if (!user) {
        logger.warn(`[user-auth] MFA OTP verification failed: user ${input.email} not found`);
        throw new InvalidCredentialsError();
      }

      if (user.status !== 'ACTIVE') {
        logger.warn(`[user-auth] MFA OTP verification blocked: account ${input.email} inactive`);
        throw new AccountInactiveError();
      }

      await this.consumeOtp(user.email, input.otp, 'OTP');

      await this.users.setLastLogin(user.id);
      recordAudit({
        action: 'user_auth.login.succeeded',
        actorId: user.id,
        resource: `user:${user.id}`,
        meta: { email: user.email },
      });
      const refreshToken = await this.issueRefreshToken(user);
      logger.info(`[user-auth] user ${user.email} authenticated (MFA ok)`);

      return this.sessionFor(user, refreshToken);
    } catch (error) {
      if (
        !(error instanceof InvalidCredentialsError) &&
        !(error instanceof AccountInactiveError) &&
        !(error instanceof InvalidOtpError) &&
        !(error instanceof OtpMaxAttemptsError)
      ) {
        logger.error(`[user-auth] verifyOtp error for ${input.email}:`, error);
      }
      throw error;
    }
  }

  /**
   * Google sign-in: verify the ID token, then match by `googleSub`, link by
   * verified email, or auto-provision an ACTIVE account (Google already
   * verified the email — no OTP step on this path).
   */
  async googleSignIn(input: GoogleSignInInput): Promise<UserSession> {
    let profile;
    try {
      profile = await verifyGoogleIdToken(input.idToken);
    } catch {
      throw new GoogleAccountError('Invalid Google credential');
    }

    if (!profile.emailVerified) {
      throw new GoogleAccountError('Google email is not verified');
    }

    try {
      let user = await this.users.findByGoogleSub(profile.googleSub);
      if (!user) {
        const byEmail = await this.users.findByEmail(profile.email);
        if (byEmail) {
          if (byEmail.status !== 'ACTIVE') {
            throw new AccountInactiveError();
          }
          user = await this.users.updateUser(byEmail.id, { googleSub: profile.googleSub });
          logger.info(`[user-auth] Google login linked to existing account ${user.email}`);
        } else {
          user = await this.users.createUser({
            firstName: profile.firstName || 'Partner',
            lastName: profile.lastName || '',
            email: profile.email,
            googleSub: profile.googleSub,
            status: 'ACTIVE',
          });
          eventBus.safeEmit<UserWelcomeMailRequestedPayload>(USER_AUTH_EVENTS.WELCOME_MAIL_REQUESTED, {
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
          });
          logger.info(`[user-auth] Google account auto-provisioned for ${user.email}`);
        }
      } else if (user.status !== 'ACTIVE') {
        throw new AccountInactiveError();
      }

      await this.users.setLastLogin(user.id);
      recordAudit({
        action: 'user_auth.google.signin',
        actorId: user.id,
        resource: `user:${user.id}`,
        meta: { email: user.email },
      });
      const refreshToken = await this.issueRefreshToken(user);
      return this.sessionFor(user, refreshToken);
    } catch (error) {
      if (!(error instanceof AccountInactiveError) && !(error instanceof GoogleAccountError)) {
        logger.error('[user-auth] googleSignIn error:', error);
      }
      throw error;
    }
  }

  async resendOtp(input: ResendOtpInput): Promise<OtpIssuedResult> {
    try {
      const user = await this.users.findByEmail(input.email);
      if (!user) {
        logger.warn(`[user-auth] resend OTP failed: user ${input.email} not found`);
        throw new InvalidCredentialsError();
      }

      if (input.purpose === 'verify_email') {
        if (user.status !== 'PENDING') {
          logger.warn(`[user-auth] resend verify email OTP rejected: account ${input.email} already active`);
          throw new AccountNotVerifiedError();
        }
        return await this.issueOtp(user, 'VERIFY_EMAIL');
      }

      if (user.status !== 'ACTIVE') {
        logger.warn(`[user-auth] resend login OTP rejected: account ${input.email} inactive`);
        throw new AccountInactiveError();
      }

      return await this.issueOtp(user, 'OTP');
    } catch (error) {
      if (
        !(error instanceof InvalidCredentialsError) &&
        !(error instanceof AccountNotVerifiedError) &&
        !(error instanceof AccountInactiveError)
      ) {
        logger.error(`[user-auth] resendOtp error for ${input.email}:`, error);
      }
      throw error;
    }
  }

  /** Fresh user row for the authenticated principal. */
  async getUserById(id: string): Promise<User | null> {
    try {
      return await this.users.findById(id);
    } catch (error) {
      logger.error(`[user-auth] getUserById error for ID ${id}:`, error);
      throw error;
    }
  }

  /** Rotate refresh token (single-use): consume the presented one, issue a new pair. */
  async refresh(rawRefreshToken: string): Promise<UserSession> {
    try {
      const token = await this.tokens.findByHash(hashToken(rawRefreshToken));
      if (!token || token.tokenType !== 'REFRESH' || token.consumedAt) {
        logger.warn('[user-auth] token refresh failed: invalid or already consumed refresh token');
        throw new InvalidTokenError();
      }

      if (token.expiresAt.getTime() < Date.now()) {
        logger.warn('[user-auth] token refresh failed: refresh token expired');
        throw new InvalidTokenError('Refresh token expired');
      }

      const user = token.userId ? await this.users.findById(token.userId) : null;
      if (!user) {
        logger.warn(`[user-auth] token refresh failed: associated user ID ${token.userId} not found`);
        throw new InvalidTokenError();
      }

      if (user.status !== 'ACTIVE') {
        logger.warn(`[user-auth] token refresh failed: user ${user.email} is inactive`);
        throw new AccountInactiveError();
      }

      await this.tokens.markConsumed(token.id);
      const refreshToken = await this.issueRefreshToken(user);
      logger.info(`[user-auth] tokens rotated successfully for ${user.email}`);

      return this.sessionFor(user, refreshToken);
    } catch (error) {
      if (!(error instanceof InvalidTokenError) && !(error instanceof AccountInactiveError)) {
        logger.error('[user-auth] refresh token error:', error);
      }
      throw error;
    }
  }

  async logout(rawRefreshToken: string): Promise<void> {
    try {
      const token = await this.tokens.findByHash(hashToken(rawRefreshToken));
      if (token && !token.consumedAt) {
        await this.tokens.markConsumed(token.id);
        logger.info(`[user-auth] refresh token invalidated on logout for user ID ${token.userId}`);
      }
    } catch (error) {
      logger.error('[user-auth] logout error:', error);
      throw error;
    }
  }

  /**
   * Change password. Google-only accounts (no hash yet) set their first
   * password without an old one — subsequent changes require it.
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    try {
      const user = await this.users.findById(userId);
      if (!user) {
        logger.warn(`[user-auth] change password failed: user ID ${userId} not found`);
        throw new InvalidCredentialsError();
      }

      if (user.passwordHash) {
        if (!(await verifyPassword(input.oldPassword, user.passwordHash))) {
          logger.warn(`[user-auth] change password failed: incorrect old password for ${user.email}`);
          throw new InvalidCredentialsError();
        }
      } else if (!input.oldPassword) {
        throw new InvalidCredentialsError();
      }

      const passwordHash = await hashPassword(input.newPassword);
      await this.users.updateUser(userId, { passwordHash });
      recordAudit({
        action: 'user_auth.password.changed',
        actorId: user.id,
        resource: `user:${user.id}`,
        meta: { email: user.email },
      });
      logger.info(`[user-auth] password changed successfully for ${user.email}`);
    } catch (error) {
      if (!(error instanceof InvalidCredentialsError)) {
        logger.error(`[user-auth] changePassword error for user ID ${userId}:`, error);
      }
      throw error;
    }
  }

  /**
   * Starts a password reset. Deliberately resolves the same way whether or not
   * the email belongs to an active account (anti-enumeration).
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<OtpIssuedResult> {
    try {
      const user = await this.users.findByEmail(input.email);
      if (!user || user.status !== 'ACTIVE' || !user.passwordHash) {
        logger.info(`[user-auth] password reset requested for unknown/inactive/Google-only account ${input.email}`);
        return { otpSent: false, expiresInMinutes: ENV.OTP_TTL_MINUTES };
      }

      logger.info(`[user-auth] password reset requested for ${user.email}`);
      return await this.issueOtp(user, 'RESET_PASSWORD');
    } catch (error) {
      logger.error(`[user-auth] forgotPassword error for ${input.email}:`, error);
      throw error;
    }
  }

  /**
   * Completes a password reset: verifies the emailed OTP, stores the new
   * password hash, and revokes every outstanding refresh token.
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    try {
      const user = await this.users.findByEmail(input.email);
      if (!user) {
        logger.warn(`[user-auth] reset password failed: user ${input.email} not found`);
        throw new InvalidCredentialsError();
      }

      if (user.status !== 'ACTIVE') {
        logger.warn(`[user-auth] reset password failed: account ${input.email} inactive`);
        throw new AccountInactiveError();
      }

      await this.consumeOtp(user.email, input.otp, 'RESET_PASSWORD');

      const passwordHash = await hashPassword(input.newPassword);
      await this.users.updateUser(user.id, { passwordHash });
      await this.tokens.deactivateActive('REFRESH', user.email);

      recordAudit({
        action: 'user_auth.password.reset',
        actorId: user.id,
        resource: `user:${user.id}`,
        meta: { email: user.email },
      });

      logger.info(`[user-auth] password reset completed successfully for ${user.email}`);
    } catch (error) {
      if (
        !(error instanceof InvalidCredentialsError) &&
        !(error instanceof AccountInactiveError) &&
        !(error instanceof InvalidOtpError) &&
        !(error instanceof OtpMaxAttemptsError)
      ) {
        logger.error(`[user-auth] resetPassword error for ${input.email}:`, error);
      }
      throw error;
    }
  }
}

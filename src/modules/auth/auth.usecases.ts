import type { Admin, AdminStatus, RoleName, TokenType } from '@prisma/client';
import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { hashPassword, verifyPassword } from '@/utils/password';
import { generateOtp } from '@/utils/otp';
import { generateOpaqueToken, hashToken } from '@/utils/tokens';
import { signAccessToken } from '@/utils/jwt';
import { verifyGoogleIdToken } from '@/utils/google';
import { AdminRepository } from '@/lib/dal/repositories/admin/admin.repository';
import { RoleRepository } from '@/lib/dal/repositories/role/role.repository';
import { VerificationTokenRepository } from '@/lib/dal/repositories/verificationToken/verificationToken.repository';
import { buildPrincipal } from '@/lib/security/principal';
import type { AdminWithPermissions } from '@/lib/security/principal';
import { eventBus } from '@/lib/events/event-bus';
import { AUTH_EVENTS } from './auth.events';
import type { OtpMailRequestedPayload, WelcomeMailRequestedPayload } from './auth.events';
import { recordAudit } from '@/modules/audit/audit.events';
import { AuditLogRepository } from '@/lib/dal/repositories/auditLog/auditLog.repository';
import { TransactionRunner } from '@/lib/dal/base/transaction';
import { toAuditInput } from '@/lib/audit/auditContext';
import type { AdminAuditContext } from '@/lib/audit/auditContext';
import type {
  AuthSession,
  ChangePasswordInput,
  ForgotPasswordInput,
  GoogleSignInInput,
  LoginInput,
  OtpIssuedResult,
  RegisterInput,
  ResendOtpInput,
  RequestMeta,
  ResetPasswordInput,
  UpdateProfileInput,
  VerifyEmailInput,
  VerifyOtpInput,
} from './auth.types';
import {
  AccountAlreadyExistsError,
  AccountInactiveError,
  AccountNotVerifiedError,
  GoogleAccountError,
  GoogleEmailMismatchError,
  InvalidCredentialsError,
  InvalidOtpError,
  InvalidTokenError,
  OtpMaxAttemptsError,
  RegistrationNotAllowedError,
} from './auth.errors';

type OtpTokenType = 'OTP' | 'VERIFY_EMAIL' | 'RESET_PASSWORD';

export class AuthUsecases {
  constructor(
    private readonly admins: AdminRepository = new AdminRepository(),
    private readonly roles: RoleRepository = new RoleRepository(),
    private readonly tokens: VerificationTokenRepository = new VerificationTokenRepository(),
    private readonly auditLogs: AuditLogRepository = new AuditLogRepository(),
    private readonly tx: TransactionRunner = new TransactionRunner()
  ) {}

  private isAllowedToRegister(email: string): boolean {
    return ENV.ADMIN_MAILS.includes(email.toLowerCase());
  }

  private static otpExpiry(): Date {
    return new Date(Date.now() + ENV.OTP_TTL_MINUTES * 60 * 1000);
  }

  private static refreshExpiry(): Date {
    return new Date(Date.now() + ENV.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  /**
   * Issues an OTP (of the given token type) for an admin and hands the email to
   * the background event bus. Any previously active OTP of the same type is
   * invalidated (single-active).
   */
  private async issueOtp(admin: Pick<Admin, 'id' | 'email' | 'firstName'>, tokenType: OtpTokenType): Promise<OtpIssuedResult> {
    try {
      const otp = generateOtp(6);
      const expiresAt = AuthUsecases.otpExpiry();

      await this.tokens.deactivateActive(tokenType, admin.email);
      await this.tokens.createToken({
        tokenType,
        channel: 'EMAIL',
        adminId: admin.id,
        identifier: admin.email,
        tokenHash: hashToken(otp),
        expiresAt,
      });

      // Hand the email to the background event bus: the OTP row is already
      // committed, so delivery must not block the HTTP response.
      eventBus.safeEmit<OtpMailRequestedPayload>(AUTH_EVENTS.OTP_MAIL_REQUESTED, {
        adminId: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        otp,
        tokenType,
        expiresInMinutes: ENV.OTP_TTL_MINUTES,
      });

      // Delivery is asynchronous now, so `otpSent` reports that a valid code
      // was issued (its email is dispatched by the event handler).
      return { otpSent: true, expiresInMinutes: ENV.OTP_TTL_MINUTES };
    } catch (error) {
      logger.error(`[auth] failed to issue OTP for ${admin.email} (type: ${tokenType}):`, error);
      throw error;
    }
  }

  /** Verify + consume an OTP, enforcing attempt limits. */
  private async consumeOtp(email: string, otp: string, tokenType: OtpTokenType): Promise<void> {
    try {
      const token = await this.tokens.findActive(tokenType, email);
      if (!token) {
        logger.warn(`[auth] active OTP token not found for ${email} (type: ${tokenType})`);
        throw new InvalidOtpError();
      }

      if (token.failedAttempts >= ENV.OTP_MAX_ATTEMPTS) {
        logger.warn(`[auth] max OTP attempts reached for ${email} (type: ${tokenType})`);
        throw new OtpMaxAttemptsError();
      }

      if (hashToken(otp) !== token.tokenHash) {
        await this.tokens.incrementFailedAttempts(token.id);
        logger.warn(`[auth] invalid OTP attempt for ${email} (failed attempt ${token.failedAttempts + 1}/${ENV.OTP_MAX_ATTEMPTS})`);
        throw new InvalidOtpError();
      }

      await this.tokens.markConsumed(token.id);
    } catch (error) {
      if (!(error instanceof InvalidOtpError) && !(error instanceof OtpMaxAttemptsError)) {
        logger.error(`[auth] unexpected error during OTP consumption for ${email}:`, error);
      }
      throw error;
    }
  }

  /** Issue a refresh-token row and return its raw value. */
  private async issueRefreshToken(admin: AdminWithPermissions): Promise<string> {
    try {
      const raw = generateOpaqueToken();
      await this.tokens.createToken({
        tokenType: 'REFRESH',
        adminId: admin.id,
        identifier: admin.email,
        tokenHash: hashToken(raw),
        expiresAt: AuthUsecases.refreshExpiry(),
      });
      return raw;
    } catch (error) {
      logger.error(`[auth] failed to issue refresh token for ${admin.email}:`, error);
      throw error;
    }
  }

  private async sessionFor(admin: AdminWithPermissions, refreshToken: string): Promise<AuthSession> {
    try {
      const accessToken = signAccessToken(buildPrincipal(admin));
      return { admin, accessToken, refreshToken };
    } catch (error) {
      logger.error(`[auth] failed to generate session for ${admin.email}:`, error);
      throw error;
    }
  }

  async register(input: RegisterInput): Promise<{ admin: AdminWithPermissions }> {
    try {
      if (!this.isAllowedToRegister(input.email)) {
        logger.warn(`[auth] registration attempt blocked for unauthorized email ${input.email}`);
        throw new RegistrationNotAllowedError(input.email);
      }

      const existing = await this.admins.findByEmail(input.email);
      if (existing) {
        logger.warn(`[auth] registration failed: account already exists for ${input.email}`);
        throw new AccountAlreadyExistsError();
      }

      const superAdminRole = await this.roles.findByName('SUPER_ADMIN');
      if (!superAdminRole) {
        logger.error('[auth] registration failed: SUPER_ADMIN role not found in database');
        throw new Error('SUPER_ADMIN role not seeded — run prisma seed');
      }

      const passwordHash = await hashPassword(input.password);
      const admin = await this.admins.createAdmin({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        status: 'PENDING',
        isSuperAdmin: true,
        roleId: superAdminRole.id,
      });

      await this.issueOtp(admin, 'VERIFY_EMAIL');
      logger.info(`[auth] super-admin registration initiated for ${admin.email}`);

      const created = await this.admins.findByIdWithRole(admin.id);
      recordAudit({
        action: 'auth.registered',
        actorId: admin.id,
        resource: `admin:${admin.id}`,
        meta: { email: admin.email },
      });
      return { admin: created as AdminWithPermissions };
    } catch (error) {
      if (
        !(error instanceof RegistrationNotAllowedError) &&
        !(error instanceof AccountAlreadyExistsError)
      ) {
        logger.error(`[auth] registration error for ${input.email}:`, error);
      }
      throw error;
    }
  }

  async verifyEmail(input: VerifyEmailInput): Promise<{ admin: AdminWithPermissions }> {
    try {
      const admin = await this.admins.findByEmailWithRole(input.email);
      if (!admin) {
        logger.warn(`[auth] email verification failed: admin ${input.email} not found`);
        throw new InvalidCredentialsError();
      }

      await this.consumeOtp(admin.email, input.otp, 'VERIFY_EMAIL');

      const updated = await this.admins.updateAdmin(admin.id, { status: 'ACTIVE' });

      // Non-critical side effects (welcome email + audit trail) leave the
      // request path here; the account is already ACTIVE in the database.
      eventBus.safeEmit<WelcomeMailRequestedPayload>(AUTH_EVENTS.WELCOME_MAIL_REQUESTED, {
        adminId: admin.id,
        email: admin.email,
        firstName: admin.firstName,
      });
      recordAudit({
        action: 'auth.email_verified',
        actorId: admin.id,
        resource: `admin:${admin.id}`,
        meta: { email: admin.email },
      });

      logger.info(`[auth] admin ${admin.email} verified successfully`);
      return { admin: { ...updated, roleName: admin.roleName, permissions: admin.permissions } as AdminWithPermissions };
    } catch (error) {
      if (!(error instanceof InvalidCredentialsError) && !(error instanceof InvalidOtpError) && !(error instanceof OtpMaxAttemptsError)) {
        logger.error(`[auth] verifyEmail error for ${input.email}:`, error);
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<OtpIssuedResult> {
    try {
      const admin = await this.admins.findByEmailWithRole(input.email);
      const ok = admin && (await verifyPassword(input.password, admin.passwordHash));
      
      if (!admin || !ok) {
        logger.warn(`[auth] login failed: invalid credentials for ${input.email}`);
        throw new InvalidCredentialsError();
      }

      if (admin.status === 'PENDING') {
        logger.warn(`[auth] login blocked: account ${input.email} is pending verification`);
        throw new AccountNotVerifiedError();
      }

      if (admin.status !== 'ACTIVE') {
        logger.warn(`[auth] login blocked: account ${input.email} is inactive/suspended`);
        throw new AccountInactiveError();
      }

      logger.info(`[auth] password verified for ${admin.email}, issuing MFA OTP`);
      return await this.issueOtp(admin, 'OTP');
    } catch (error) {
      if (
        !(error instanceof InvalidCredentialsError) &&
        !(error instanceof AccountNotVerifiedError) &&
        !(error instanceof AccountInactiveError)
      ) {
        logger.error(`[auth] login error for ${input.email}:`, error);
      }
      throw error;
    }
  }

  async verifyOtp(input: VerifyOtpInput): Promise<AuthSession> {
    try {
      const admin = await this.admins.findByEmailWithRole(input.email);
      if (!admin) {
        logger.warn(`[auth] MFA OTP verification failed: admin ${input.email} not found`);
        throw new InvalidCredentialsError();
      }

      if (admin.status !== 'ACTIVE') {
        logger.warn(`[auth] MFA OTP verification blocked: account ${input.email} inactive`);
        throw new AccountInactiveError();
      }

      await this.consumeOtp(admin.email, input.otp, 'OTP');

      await this.admins.setLastLogin(admin.id);
      recordAudit({
        action: 'auth.login.succeeded',
        actorId: admin.id,
        resource: `admin:${admin.id}`,
        meta: { email: admin.email },
      });
      const refreshToken = await this.issueRefreshToken(admin);
      logger.info(`[auth] admin ${admin.email} authenticated (MFA ok)`);

      return await this.sessionFor(admin, refreshToken);
    } catch (error) {
      if (
        !(error instanceof InvalidCredentialsError) &&
        !(error instanceof AccountInactiveError) &&
        !(error instanceof InvalidOtpError) &&
        !(error instanceof OtpMaxAttemptsError)
      ) {
        logger.error(`[auth] verifyOtp error for ${input.email}:`, error);
      }
      throw error;
    }
  }

  async resendOtp(input: ResendOtpInput): Promise<OtpIssuedResult> {
    try {
      const admin = await this.admins.findByEmailWithRole(input.email);
      if (!admin) {
        logger.warn(`[auth] resend OTP failed: admin ${input.email} not found`);
        throw new InvalidCredentialsError();
      }

      if (input.purpose === 'verify_email') {
        if (admin.status !== 'PENDING') {
          logger.warn(`[auth] resend verify email OTP rejected: account ${input.email} already active`);
          throw new AccountNotVerifiedError();
        }
        return await this.issueOtp(admin, 'VERIFY_EMAIL');
      }

      if (admin.status !== 'ACTIVE') {
        logger.warn(`[auth] resend login OTP rejected: account ${input.email} inactive`);
        throw new AccountInactiveError();
      }

      return await this.issueOtp(admin, 'OTP');
    } catch (error) {
      if (
        !(error instanceof InvalidCredentialsError) &&
        !(error instanceof AccountNotVerifiedError) &&
        !(error instanceof AccountInactiveError)
      ) {
        logger.error(`[auth] resendOtp error for ${input.email}:`, error);
      }
      throw error;
    }
  }

  /** Fresh admin row (with role + permissions) for the authenticated principal. */
  async getAdminById(id: string): Promise<AdminWithPermissions | null> {
    try {
      return await this.admins.findByIdWithRole(id);
    } catch (error) {
      logger.error(`[auth] getAdminById error for ID ${id}:`, error);
      throw error;
    }
  }

  async refresh(rawRefreshToken: string): Promise<AuthSession> {
    try {
      const token = await this.tokens.findByHash(hashToken(rawRefreshToken));
      if (!token || token.tokenType !== 'REFRESH' || token.consumedAt) {
        logger.warn('[auth] token refresh failed: invalid or already consumed refresh token');
        throw new InvalidTokenError();
      }

      if (token.expiresAt.getTime() < Date.now()) {
        logger.warn('[auth] token refresh failed: refresh token expired');
        throw new InvalidTokenError('Refresh token expired');
      }

      const admin = await this.admins.findByIdWithRole(token.adminId ?? '');
      if (!admin) {
        logger.warn(`[auth] token refresh failed: associated admin ID ${token.adminId} not found`);
        throw new InvalidTokenError();
      }

      if (admin.status !== 'ACTIVE') {
        logger.warn(`[auth] token refresh failed: admin ${admin.email} is inactive`);
        throw new AccountInactiveError();
      }

      await this.tokens.markConsumed(token.id);
      const refreshToken = await this.issueRefreshToken(admin);
      logger.info(`[auth] tokens rotated successfully for ${admin.email}`);

      return await this.sessionFor(admin, refreshToken);
    } catch (error) {
      if (!(error instanceof InvalidTokenError) && !(error instanceof AccountInactiveError)) {
        logger.error('[auth] refresh token error:', error);
      }
      throw error;
    }
  }

  /**
   * Revokes the refresh token when present. Works without a valid access token
   * (the refresh cookie is the credential), so an expired session still signs out.
   */
  async logout(rawRefreshToken: string | undefined, meta: RequestMeta = { ip: null, userAgent: null }): Promise<void> {
    try {
      if (!rawRefreshToken) return;
      const token = await this.tokens.findByHash(hashToken(rawRefreshToken));
      if (token && token.tokenType === 'REFRESH' && !token.consumedAt) {
        await this.tokens.markConsumed(token.id);
        if (token.adminId) {
          recordAudit({
            action: 'auth.logout',
            actorId: token.adminId,
            resource: `admin:${token.adminId}`,
            ip: meta.ip,
            userAgent: meta.userAgent,
            meta: { email: token.identifier },
          });
        }
        logger.info(`[auth] refresh token invalidated on logout for admin ID ${token.adminId}`);
      }
    } catch (error) {
      logger.error('[auth] logout error:', error);
      throw error;
    }
  }

  /**
   * Changes the password and signs out every other session (the caller's own
   * refresh token, when known, is kept). Returns how many sessions were revoked.
   */
  async changePassword(
    adminId: string,
    input: ChangePasswordInput,
    currentRefreshToken?: string
  ): Promise<{ otherSessionsSignedOut: number }> {
    try {
      const admin = await this.admins.findById(adminId);
      if (!admin) {
        logger.warn(`[auth] change password failed: admin ID ${adminId} not found`);
        throw new InvalidCredentialsError();
      }

      if (!(await verifyPassword(input.oldPassword, admin.passwordHash))) {
        logger.warn(`[auth] change password failed: incorrect old password for ${admin.email}`);
        throw new InvalidCredentialsError();
      }

      const passwordHash = await hashPassword(input.newPassword);
      await this.admins.updateAdmin(adminId, { passwordHash });
      const otherSessionsSignedOut = await this.tokens.revokeOtherRefreshTokens(
        adminId,
        currentRefreshToken ? hashToken(currentRefreshToken) : null
      );
      recordAudit({
        action: 'auth.password.changed',
        actorId: admin.id,
        resource: `admin:${admin.id}`,
        meta: { email: admin.email, otherSessionsSignedOut },
      });
      logger.info(`[auth] password changed for ${admin.email}; ${otherSessionsSignedOut} other session(s) signed out`);
      return { otherSessionsSignedOut };
    } catch (error) {
      if (!(error instanceof InvalidCredentialsError)) {
        logger.error(`[auth] changePassword error for admin ID ${adminId}:`, error);
      }
      throw error;
    }
  }

  /**
   * Starts a password reset. Deliberately resolves the same way whether or not
   * the email belongs to an active account, so the endpoint cannot be used to
   * enumerate admin addresses.
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<OtpIssuedResult> {
    try {
      const admin = await this.admins.findByEmailWithRole(input.email);
      if (!admin || admin.status !== 'ACTIVE') {
        logger.info(`[auth] password reset requested for unknown/inactive account ${input.email}`);
        return { otpSent: false, expiresInMinutes: ENV.OTP_TTL_MINUTES };
      }

      logger.info(`[auth] password reset requested for ${admin.email}`);
      return await this.issueOtp(admin, 'RESET_PASSWORD');
    } catch (error) {
      logger.error(`[auth] forgotPassword error for ${input.email}:`, error);
      throw error;
    }
  }

  /**
   * Completes a password reset: verifies the emailed OTP, stores the new
   * password hash, and revokes every outstanding refresh token so sessions
   * created with the old password can no longer be renewed.
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    try {
      const admin = await this.admins.findByEmailWithRole(input.email);
      if (!admin) {
        logger.warn(`[auth] reset password failed: admin ${input.email} not found`);
        throw new InvalidCredentialsError();
      }

      if (admin.status !== 'ACTIVE') {
        logger.warn(`[auth] reset password failed: account ${input.email} inactive`);
        throw new AccountInactiveError();
      }

      await this.consumeOtp(admin.email, input.otp, 'RESET_PASSWORD');

      const passwordHash = await hashPassword(input.newPassword);
      await this.admins.updateAdmin(admin.id, { passwordHash });
      await this.tokens.deactivateActive('REFRESH', admin.email);

      recordAudit({
        action: 'auth.password.reset',
        actorId: admin.id,
        resource: `admin:${admin.id}`,
        meta: { email: admin.email },
      });

      logger.info(`[auth] password reset completed successfully for ${admin.email}`);
    } catch (error) {
      if (
        !(error instanceof InvalidCredentialsError) &&
        !(error instanceof AccountInactiveError) &&
        !(error instanceof InvalidOtpError) &&
        !(error instanceof OtpMaxAttemptsError)
      ) {
        logger.error(`[auth] resetPassword error for ${input.email}:`, error);
      }
      throw error;
    }
  }

  /**
   * Admin Google sign-in. No auto-provisioning and no email-based linking on
   * this path: the account must already exist, be ACTIVE, and have a linked
   * `googleSub` (see `linkGoogle`). Google auth counts as the second factor,
   * so no email OTP is issued here.
   */
  async googleSignIn(input: GoogleSignInInput): Promise<AuthSession> {
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
      const row = await this.admins.findFirst({ googleSub: profile.googleSub });
      if (!row) {
        logger.warn(`[auth] Google sign-in rejected: no linked admin for sub ${profile.googleSub}`);
        throw new GoogleAccountError('No admin account is linked to this Google identity');
      }

      const admin = await this.admins.findByIdWithRole(row.id);
      if (!admin || admin.status !== 'ACTIVE') {
        logger.warn(`[auth] Google sign-in blocked: linked account inactive`);
        throw new AccountInactiveError();
      }

      await this.admins.setLastLogin(admin.id);
      recordAudit({
        action: 'auth.google.signin',
        actorId: admin.id,
        resource: `admin:${admin.id}`,
        meta: { email: admin.email },
      });
      const refreshToken = await this.issueRefreshToken(admin);
      logger.info(`[auth] admin ${admin.email} authenticated via Google`);

      return await this.sessionFor(admin, refreshToken);
    } catch (error) {
      if (!(error instanceof GoogleAccountError) && !(error instanceof AccountInactiveError)) {
        logger.error('[auth] googleSignIn error:', error);
      }
      throw error;
    }
  }

  /**
   * Links a Google identity to the authenticated admin. The Google email must
   * match the admin email — prevents hostile account binding.
   */
  async linkGoogle(adminId: string, input: GoogleSignInInput): Promise<{ admin: AdminWithPermissions }> {
    let profile;
    try {
      profile = await verifyGoogleIdToken(input.idToken);
    } catch {
      throw new GoogleAccountError('Invalid Google credential');
    }

    const admin = await this.admins.findByIdWithRole(adminId);
    if (!admin) {
      throw new InvalidCredentialsError();
    }

    if (profile.email !== admin.email.toLowerCase()) {
      logger.warn(`[auth] Google link rejected: ${profile.email} != ${admin.email}`);
      throw new GoogleEmailMismatchError();
    }

    await this.admins.updateAdmin(adminId, { googleSub: profile.googleSub });
    recordAudit({
      action: 'auth.google.linked',
      actorId: admin.id,
      resource: `admin:${admin.id}`,
      meta: { email: admin.email },
    });
    logger.info(`[auth] Google identity linked for ${admin.email}`);

    const linked = await this.admins.findByIdWithRole(adminId);
    return { admin: linked as AdminWithPermissions };
  }

  /** Self-service profile edit; writes the change and its audit row in one transaction. */
  async updateProfile(ctx: AdminAuditContext, input: UpdateProfileInput): Promise<AdminWithPermissions> {
    const current = await this.admins.findByIdWithRole(ctx.actor.id);
    if (!current) throw new InvalidCredentialsError();

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const data: UpdateProfileInput = {};
    if (input.firstName !== undefined && input.firstName !== current.firstName) {
      changes.firstName = { from: current.firstName, to: input.firstName };
      data.firstName = input.firstName;
    }
    if (input.lastName !== undefined && input.lastName !== current.lastName) {
      changes.lastName = { from: current.lastName, to: input.lastName };
      data.lastName = input.lastName;
    }
    const nextPhone = input.phone === undefined ? undefined : input.phone || null;
    if (nextPhone !== undefined && nextPhone !== current.phone) {
      changes.phone = { from: current.phone, to: nextPhone };
      data.phone = nextPhone;
    }
    if (Object.keys(data).length === 0) return current;

    await this.tx.run(async (db) => {
      await this.admins.updateAdmin(current.id, data, db);
      await this.auditLogs.record(
        toAuditInput(ctx, 'auth.profile.updated', `admin:${current.id}`, { email: current.email, changes }),
        db
      );
    });
    logger.info(`[auth] ${current.email} updated their profile (${Object.keys(data).join(', ')})`);
    return (await this.admins.findByIdWithRole(current.id)) as AdminWithPermissions;
  }

  /** Removes the linked Google identity (every admin keeps a password, so this cannot lock them out). */
  async unlinkGoogle(ctx: AdminAuditContext): Promise<AdminWithPermissions> {
    const current = await this.admins.findByIdWithRole(ctx.actor.id);
    if (!current) throw new InvalidCredentialsError();
    if (!current.googleSub) return current;

    await this.tx.run(async (db) => {
      await this.admins.updateAdmin(current.id, { googleSub: null }, db);
      await this.auditLogs.record(toAuditInput(ctx, 'auth.google.unlinked', `admin:${current.id}`, { email: current.email }), db);
    });
    logger.info(`[auth] Google identity unlinked for ${current.email}`);
    return (await this.admins.findByIdWithRole(current.id)) as AdminWithPermissions;
  }
}

export type { AdminStatus, RoleName, TokenType };
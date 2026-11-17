import type { NextFunction, Request, Response } from 'express';
import { AuthUsecases } from './auth.usecases';
import { clearAdminAuthCookies, ADMIN_REFRESH_COOKIE, setAdminAuthCookies } from '@/utils/cookies';
import { toAdminPublicDto, toMessageDto, toOtpIssuedDto, toPasswordResetRequestedDto, toSessionDto } from './auth.output';
import { adminAuditContext } from '@/lib/audit/auditContext';
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleSignInDto,
  LoginDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  UpdateMeDto,
  VerifyEmailDto,
  VerifyOtpDto,
} from './validation.schema';

export class AuthController {
  constructor(private readonly usecases: AuthUsecases = new AuthUsecases()) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as RegisterDto;
      const { admin } = await this.usecases.register(body);
      res.status(201).json({ success: true, message: 'Registration started — verify your email', data: { admin: toAdminPublicDto(admin) } });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as VerifyEmailDto;
      const { admin } = await this.usecases.verifyEmail(body);
      res.json({ success: true, message: 'Email verified — you can now sign in', data: { admin: toAdminPublicDto(admin) } });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as LoginDto;
      const result = await this.usecases.login(body);
      res.json({ success: true, data: { ...toOtpIssuedDto(result), requiresOtp: true } });
    } catch (error) {
      next(error);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as VerifyOtpDto;
      const session = await this.usecases.verifyOtp(body);
      setAdminAuthCookies(res, session.accessToken, session.refreshToken);
      res.json({ success: true, data: toSessionDto(session) });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const raw = (req.cookies?.[ADMIN_REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined);
      if (!raw) {
        res.status(401).json({ success: false, error: 'Refresh token required' });
        return;
      }
      const session = await this.usecases.refresh(raw);
      setAdminAuthCookies(res, session.accessToken, session.refreshToken);
      res.json({ success: true, data: toSessionDto(session) });
    } catch (error) {
      next(error);
    }
  };

  /** Public: the refresh cookie is the credential, so an expired access token still signs out. */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const raw = (req.cookies?.[ADMIN_REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined);
      await this.usecases.logout(raw, { ip: req.ip ?? null, userAgent: req.get('user-agent')?.slice(0, 512) ?? null });
      clearAdminAuthCookies(res);
      res.json({ success: true, data: toMessageDto('Signed out') });
    } catch (error) {
      // Cookies are cleared even when revocation fails, so the browser is signed out regardless.
      clearAdminAuthCookies(res);
      next(error);
    }
  };

  resendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as ResendOtpDto;
      const result = await this.usecases.resendOtp(body);
      res.json({ success: true, data: toOtpIssuedDto(result) });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const admin = await this.usecases.getAdminById(req.admin!.id);
      if (!admin) {
        res.status(404).json({ success: false, error: 'Admin not found' });
        return;
      }
      res.json({ success: true, data: { admin: toAdminPublicDto(admin) } });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as ChangePasswordDto;
      const currentRefresh = req.cookies?.[ADMIN_REFRESH_COOKIE] as string | undefined;
      const { otherSessionsSignedOut } = await this.usecases.changePassword(req.admin!.id, body, currentRefresh);
      res.json({ success: true, data: { message: 'Password changed', otherSessionsSignedOut } });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as ForgotPasswordDto;
      const result = await this.usecases.forgotPassword(body);
      res.json({ success: true, data: toPasswordResetRequestedDto(result.expiresInMinutes) });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as ResetPasswordDto;
      await this.usecases.resetPassword(body);
      res.json({ success: true, data: toMessageDto('Password reset — you can now sign in') });
    } catch (error) {
      next(error);
    }
  };

  googleSignIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as GoogleSignInDto;
      const session = await this.usecases.googleSignIn(body);
      setAdminAuthCookies(res, session.accessToken, session.refreshToken);
      res.json({ success: true, data: toSessionDto(session) });
    } catch (error) {
      next(error);
    }
  };

  linkGoogle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as GoogleSignInDto;
      const { admin } = await this.usecases.linkGoogle(req.admin!.id, body);
      res.json({ success: true, data: { admin: toAdminPublicDto(admin) } });
    } catch (error) {
      next(error);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const admin = await this.usecases.updateProfile(adminAuditContext(req), req.body as UpdateMeDto);
      res.json({ success: true, data: { admin: toAdminPublicDto(admin) } });
    } catch (error) {
      next(error);
    }
  };

  unlinkGoogle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const admin = await this.usecases.unlinkGoogle(adminAuditContext(req));
      res.json({ success: true, data: { admin: toAdminPublicDto(admin) } });
    } catch (error) {
      next(error);
    }
  };
}

import type { NextFunction, Request, Response } from 'express';
import { UserAuthUsecases } from './userAuth.usecases';
import { clearUserAuthCookies, USER_REFRESH_COOKIE, setUserAuthCookies } from '@/utils/cookies';
import { toMessageDto, toOtpIssuedDto, toPasswordResetRequestedDto, toUserPublicDto } from './userAuth.output';
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleSignInDto,
  LoginDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyOtpDto,
} from './validation.schema';

export class UserAuthController {
  constructor(private readonly usecases: UserAuthUsecases = new UserAuthUsecases()) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as RegisterDto;
      const { user } = await this.usecases.register(body);
      res.status(201).json({ success: true, message: 'Registration started — verify your email', data: { user: toUserPublicDto(user) } });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as VerifyEmailDto;
      const { user } = await this.usecases.verifyEmail(body);
      res.json({ success: true, message: 'Email verified — you can now sign in', data: { user: toUserPublicDto(user) } });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as LoginDto;
      const result = await this.usecases.login(body);
      if (result.requiresOtp) {
        res.json({ success: true, data: { ...toOtpIssuedDto(result), requiresOtp: true } });
        return;
      }
      setUserAuthCookies(res, result.session.accessToken, result.session.refreshToken);
      res.json({ success: true, data: { requiresOtp: false, user: toUserPublicDto(result.session.user) } });
    } catch (error) {
      next(error);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as VerifyOtpDto;
      const session = await this.usecases.verifyOtp(body);
      setUserAuthCookies(res, session.accessToken, session.refreshToken);
      res.json({ success: true, data: { user: toUserPublicDto(session.user) } });
    } catch (error) {
      next(error);
    }
  };

  googleSignIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as GoogleSignInDto;
      const session = await this.usecases.googleSignIn(body);
      setUserAuthCookies(res, session.accessToken, session.refreshToken);
      res.json({ success: true, data: { user: toUserPublicDto(session.user) } });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const raw = (req.cookies?.[USER_REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined);
      if (!raw) {
        res.status(401).json({ success: false, error: 'Refresh token required' });
        return;
      }
      const session = await this.usecases.refresh(raw);
      setUserAuthCookies(res, session.accessToken, session.refreshToken);
      res.json({ success: true, data: { user: toUserPublicDto(session.user) } });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const raw = (req.cookies?.[USER_REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined);
      if (raw) await this.usecases.logout(raw);
      clearUserAuthCookies(res);
      res.json({ success: true, data: toMessageDto('Signed out') });
    } catch (error) {
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
      const user = await this.usecases.getUserById(req.user!.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }
      res.json({ success: true, data: { user: toUserPublicDto(user) } });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as ChangePasswordDto;
      await this.usecases.changePassword(req.user!.id, body);
      res.json({ success: true, data: toMessageDto('Password changed') });
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
}

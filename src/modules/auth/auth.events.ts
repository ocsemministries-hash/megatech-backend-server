import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { sendMail } from '@/lib/mailer/mailer';
import { eventBus } from '@/lib/events/event-bus';

// 1. Event Keys
export const AUTH_EVENTS = {
  OTP_MAIL_REQUESTED: 'auth.otp_mail_requested',
  WELCOME_MAIL_REQUESTED: 'auth.welcome_mail_requested',
} as const;

// 2. Payload Types
export type AuthOtpTokenType = 'OTP' | 'VERIFY_EMAIL' | 'RESET_PASSWORD';

export interface OtpMailRequestedPayload {
  adminId: string;
  email: string;
  firstName: string;
  /** Cleartext code — delivered by email only, never persisted in the payload log. */
  otp: string;
  tokenType: AuthOtpTokenType;
  expiresInMinutes: number;
}

export interface WelcomeMailRequestedPayload {
  adminId: string;
  email: string;
  firstName: string;
}

const OTP_MAIL_SUBJECTS: Record<AuthOtpTokenType, string> = {
  RESET_PASSWORD: 'Reset your Megatech password',
  VERIFY_EMAIL: 'Verify your Megatech account',
  OTP: 'Your Megatech login code',
};

// 3. Handlers (Always handle errors internally so background failures don't crash Node)
const handleOtpMailRequested = async (payload: OtpMailRequestedPayload): Promise<void> => {
  try {
    const mail =
      payload.tokenType === 'RESET_PASSWORD'
        ? await sendMail({
            to: payload.email,
            subject: OTP_MAIL_SUBJECTS.RESET_PASSWORD,
            template: 'resetPasswordMailTemp',
            data: [payload.firstName, payload.otp, payload.expiresInMinutes],
          })
        : await sendMail({
            to: payload.email,
            subject: OTP_MAIL_SUBJECTS[payload.tokenType],
            template: 'otpMailTemp',
            data: [payload.firstName, payload.otp, payload.expiresInMinutes],
          });

    if (!mail.delivered) {
      logger.warn(`[auth:events] OTP mail delivery failed for ${payload.email} (type: ${payload.tokenType})`);
    } else {
      logger.info(`[auth:events] OTP mail sent to ${payload.email} (type: ${payload.tokenType})`);
    }
  } catch (error) {
    logger.error(`[auth:events] Failed to send OTP mail to ${payload.email}:`, error);
  }
};

const handleWelcomeMailRequested = async (payload: WelcomeMailRequestedPayload): Promise<void> => {
  try {
    const mail = await sendMail({
      to: payload.email,
      subject: 'Welcome to Megatech',
      template: 'welcomeAdminMailTemp',
      data: [payload.firstName, ENV.ADMIN_WEB_URL],
    });

    if (!mail.delivered) {
      logger.warn(`[auth:events] Welcome mail delivery failed for ${payload.email}`);
    }
  } catch (error) {
    logger.error(`[auth:events] Failed to send welcome mail to ${payload.email}:`, error);
  }
};

// 4. Registration Entry Point
export const registerAuthEventListeners = (): void => {
  eventBus.safeOn<OtpMailRequestedPayload>(AUTH_EVENTS.OTP_MAIL_REQUESTED, handleOtpMailRequested);
  eventBus.safeOn<WelcomeMailRequestedPayload>(AUTH_EVENTS.WELCOME_MAIL_REQUESTED, handleWelcomeMailRequested);
};

export { handleOtpMailRequested, handleWelcomeMailRequested };
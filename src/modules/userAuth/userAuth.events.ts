import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { sendMail } from '@/lib/mailer/mailer';
import { eventBus } from '@/lib/events/event-bus';

// 1. Event Keys
export const USER_AUTH_EVENTS = {
  OTP_MAIL_REQUESTED: 'user_auth.otp_mail_requested',
  WELCOME_MAIL_REQUESTED: 'user_auth.welcome_mail_requested',
} as const;

// 2. Payload Types
export type UserAuthOtpTokenType = 'OTP' | 'VERIFY_EMAIL' | 'RESET_PASSWORD';

export interface UserOtpMailRequestedPayload {
  userId: string;
  email: string;
  firstName: string;
  /** Cleartext code — delivered by email only, never persisted in the payload log. */
  otp: string;
  tokenType: UserAuthOtpTokenType;
  expiresInMinutes: number;
}

export interface UserWelcomeMailRequestedPayload {
  userId: string;
  email: string;
  firstName: string;
}

const OTP_MAIL_SUBJECTS: Record<UserAuthOtpTokenType, string> = {
  RESET_PASSWORD: 'Reset your Megatech password',
  VERIFY_EMAIL: 'Verify your Megatech account',
  OTP: 'Your Megatech login code',
};

// 3. Handlers (Always handle errors internally so background failures don't crash Node)
const handleOtpMailRequested = async (payload: UserOtpMailRequestedPayload): Promise<void> => {
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
      logger.warn(`[user-auth:events] OTP mail delivery failed for ${payload.email} (type: ${payload.tokenType})`);
    } else {
      logger.info(`[user-auth:events] OTP mail sent to ${payload.email} (type: ${payload.tokenType})`);
    }
  } catch (error) {
    logger.error(`[user-auth:events] Failed to send OTP mail to ${payload.email}:`, error);
  }
};

const handleWelcomeMailRequested = async (payload: UserWelcomeMailRequestedPayload): Promise<void> => {
  try {
    const mail = await sendMail({
      to: payload.email,
      subject: 'Welcome to Megatech',
      template: 'welcomeAdminMailTemp',
      data: [payload.firstName, ENV.FRONTEND_WEB_URL],
    });

    if (!mail.delivered) {
      logger.warn(`[user-auth:events] Welcome mail delivery failed for ${payload.email}`);
    }
  } catch (error) {
    logger.error(`[user-auth:events] Failed to send welcome mail to ${payload.email}:`, error);
  }
};

// 4. Registration Entry Point
export const registerUserAuthEventListeners = (): void => {
  eventBus.safeOn<UserOtpMailRequestedPayload>(USER_AUTH_EVENTS.OTP_MAIL_REQUESTED, handleOtpMailRequested);
  eventBus.safeOn<UserWelcomeMailRequestedPayload>(USER_AUTH_EVENTS.WELCOME_MAIL_REQUESTED, handleWelcomeMailRequested);
};

export { handleOtpMailRequested, handleWelcomeMailRequested };

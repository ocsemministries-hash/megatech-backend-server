import { beforeEach, describe, expect, it } from 'vitest';
import { clearCapturedMails, getCapturedMails } from '@/lib/mailer/mailer';
import { eventBus } from '@/lib/events/event-bus';
import { AUTH_EVENTS, handleOtpMailRequested, handleWelcomeMailRequested } from '@/modules/auth/auth.events';

beforeEach(() => {
  clearCapturedMails();
});

describe('auth OTP mail handler', () => {
  it('uses the reset-password template and subject for RESET_PASSWORD', async () => {
    await handleOtpMailRequested({
      adminId: 'admin-1',
      email: 'root@megatech.org',
      firstName: 'Root',
      otp: '123456',
      tokenType: 'RESET_PASSWORD',
      expiresInMinutes: 10,
    });

    const [mail] = getCapturedMails();
    expect(mail?.template).toBe('resetPasswordMailTemp');
    expect(mail?.subject).toBe('Reset your Megatech password');
    expect(mail?.to).toBe('root@megatech.org');
    expect(mail?.html).toContain('123456');
  });

  it('uses the OTP template for email verification codes', async () => {
    await handleOtpMailRequested({
      adminId: 'admin-1',
      email: 'root@megatech.org',
      firstName: 'Root',
      otp: '654321',
      tokenType: 'VERIFY_EMAIL',
      expiresInMinutes: 10,
    });

    const [mail] = getCapturedMails();
    expect(mail?.template).toBe('otpMailTemp');
    expect(mail?.subject).toBe('Verify your Megatech account');
  });

  it('uses the login-code subject for MFA codes', async () => {
    await handleOtpMailRequested({
      adminId: 'admin-1',
      email: 'root@megatech.org',
      firstName: 'Root',
      otp: '111222',
      tokenType: 'OTP',
      expiresInMinutes: 10,
    });

    const [mail] = getCapturedMails();
    expect(mail?.template).toBe('otpMailTemp');
    expect(mail?.subject).toBe('Your Megatech login code');
  });
});

describe('auth welcome mail handler', () => {
  it('sends the welcome template with the admin web url', async () => {
    await handleWelcomeMailRequested({
      adminId: 'admin-1',
      email: 'root@megatech.org',
      firstName: 'Root',
    });

    const [mail] = getCapturedMails();
    expect(mail?.template).toBe('welcomeAdminMailTemp');
    expect(mail?.subject).toBe('Welcome to Megatech');
    expect(mail?.html).toContain('http://localhost:2384');
  });
});

describe('auth event bus wiring', () => {
  it('dispatches the OTP mail as soon as the event is emitted', () => {
    eventBus.safeEmit<{ adminId: string; email: string; firstName: string; otp: string; tokenType: 'OTP'; expiresInMinutes: number }>(
      AUTH_EVENTS.OTP_MAIL_REQUESTED,
      {
        adminId: 'admin-1',
        email: 'root@megatech.org',
        firstName: 'Root',
        otp: '999888',
        tokenType: 'OTP',
        expiresInMinutes: 10,
      }
    );

    expect(getCapturedMails()).toHaveLength(1);
  });
});
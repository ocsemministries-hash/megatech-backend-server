import { describe, expect, it } from 'vitest';
import { renderTemplate } from '@/lib/mailer/mailer';
import { otpMailTemp } from '@/lib/mailer/templates/otp.mail';
import { resetPasswordMailTemp } from '@/lib/mailer/templates/resetPassword.mail';
import { adminInviteMailTemp } from '@/lib/mailer/templates/adminInvite.mail';
import { welcomeAdminMailTemp } from '@/lib/mailer/templates/welcome.mail';

describe('mail templates', () => {
  it('renders an OTP email with the code and expiry', () => {
    const html = otpMailTemp('Ada', '123456', 10);
    expect(html).toContain('Hi Ada');
    expect(html).toContain('123456');
    expect(html).toContain('10 minutes');
  });

  it('renders a password reset email with the code and expiry', () => {
    const html = resetPasswordMailTemp('Ada', '112233', 15);
    expect(html).toContain('Hi Ada');
    expect(html).toContain('112233');
    expect(html).toContain('15 minutes');
  });

  it('renders an invite email with a role and expiry', () => {
    const html = adminInviteMailTemp('Root Admin', 'grace@megatech.org', 'https://admin.example.com/invite?token=x', 'EDITOR', 72);
    expect(html).toContain('grace@megatech.org');
    expect(html).toContain('EDITOR');
    expect(html).toContain('https://admin.example.com/invite?token=x');
    expect(html).toContain('72 hours');
  });

  it('renders a welcome email', () => {
    const html = welcomeAdminMailTemp('Grace', 'http://localhost:5173');
    expect(html).toContain('Welcome, Grace');
    expect(html).toContain('http://localhost:5173');
  });

  it('renderTemplate dispatches to the template function', () => {
    const html = renderTemplate('otpMailTemp', ['Ada', '654321', 5]);
    expect(html).toContain('654321');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { SmtpProvider, type SmtpProviderConfig } from '@/lib/mailer/providers/smtp.provider';
import type { MailProviderResult, SendEmailPayload } from '@/lib/mailer/types';

// The real nodemailer transport is only built when no factory is injected, so
// this mock lets the port/secure wiring be asserted without touching SMTP.
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: vi.fn(async () => ({ messageId: 'mid' })) })),
  },
}));

const defaults = (): SmtpProviderConfig => ({
  host: 'smtp.example.com',
  port: 587,
  user: 'svc@example.com',
  pass: 'secret',
  from: 'Megatech <no-reply@megatech.org>',
});

const ok = (id: string): SmtpSendResult => ({ messageId: id });

describe('SmtpProvider', () => {
  afterEach(() => vi.clearAllMocks());

  it('creates a lazy transport on first send', async () => {
    const transport = { sendMail: vi.fn().mockResolvedValue(ok('mid-smtp')) };
    const transportFactory = vi.fn().mockReturnValue(transport as never);

    const provider = new SmtpProvider({
      ...defaults(),
      transporterFactory: transportFactory,
    });

    const result = await provider.send({
      to: 'root@megatech.org',
      subject: 'Welcome to Megatech',
      template: 'welcomeAdminMailTemp',
      data: ['Root', 'http://localhost:5173'],
      replyTo: 'ada@example.com',
      cc: ['shared@megatech.org'],
    });

    expect(result).toEqual({ success: true, provider: 'SMTP', messageId: 'mid-smtp' });
    expect(transportFactory).toHaveBeenCalledTimes(1);
    expect(transport.sendMail).toHaveBeenCalledTimes(1);

    const [options] = transport.sendMail.mock.calls[0] as [Record<string, unknown>];
    expect(options.from).toBe('Megatech <no-reply@megatech.org>');
    expect(options.to).toBe('root@megatech.org');
    expect(options.subject).toBe('Welcome to Megatech');
    expect(options.replyTo).toBe('ada@example.com');
    expect(options.cc).toEqual(['shared@megatech.org']);
    expect(options.secure).toBeUndefined();
    expect(transportFactory).toHaveBeenCalledTimes(1);
  });

  it('isConfigured is true when a factory is injected even without host', async () => {
    const provider = new SmtpProvider({ transporterFactory: () => ({ sendMail: vi.fn() } as never) });

    expect(provider.isConfigured()).toBe(true);
  });

  it('isConfigured is false without host or factory', async () => {
    const provider = new SmtpProvider({
      ...defaults(),
      host: '',
      transporterFactory: undefined,
    });

    expect(provider.isConfigured()).toBe(false);
  });

  it('reports a failed result when no transport is configured', async () => {
    const provider = new SmtpProvider({
      ...defaults(),
      host: '',
    });

    const result = await provider.send({
      to: 'root@megatech.org',
      subject: 'Reset your Megatech password',
      template: 'otpMailTemp',
      data: ['Root', '123456', 10],
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        provider: 'SMTP',
        error: expect.any(Error),
      })
    );
    expect((result.error as Error).message).toContain('not configured');
  });

  it('returns a failed result on network errors instead of throwing', async () => {
    const transport = { sendMail: vi.fn().mockRejectedValue(new Error('connect ENETUNREACH')) };
    const provider = new SmtpProvider({
      ...defaults(),
      transporterFactory: () => transport as never,
    });

    const result = await provider.send({
      to: 'root@megatech.org',
      subject: 'Your Megatech login code',
      template: 'otpMailTemp',
      data: ['Root', '123456', 10],
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        provider: 'SMTP',
        error: expect.any(Error),
      })
    );
    expect((result.error as Error).message).toContain('ENETUNREACH');
  });

  it('port 465 selects secure mode', async () => {
    const transport = { sendMail: vi.fn().mockResolvedValue(ok('mid-secure')) };
    vi.mocked(nodemailer.createTransport).mockClear();
    // No factory injected: the provider builds a real (mocked) transport.
    const provider = new SmtpProvider({
      ...defaults(),
      port: 465,
    });

    await provider.send({
      to: 'root@megatech.org',
      subject: 'Welcome to Megatech',
      template: 'welcomeAdminMailTemp',
      data: ['Root', 'http://localhost:5173'],
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true })
    );
  });

  it('no auth config is passed when user is empty', async () => {
    const transport = { sendMail: vi.fn().mockResolvedValue(ok('mid-noauth')) };
    const provider = new SmtpProvider({
      ...defaults(),
      user: '',
      transporterFactory: () => transport as never,
    });

    await provider.send({
      to: 'root@megatech.org',
      subject: 'Welcome to Megatech',
      template: 'welcomeAdminMailTemp',
      data: ['Root', 'http://localhost:5173'],
    });

    const [options] = transport.sendMail.mock.calls[0] as [Record<string, unknown>];
    expect(options.auth).toBeUndefined();
  });

  it('renders the template payloads it was given', async () => {
    const transport = { sendMail: vi.fn().mockResolvedValue(ok('mid-render')) };
    const provider = new SmtpProvider({
      ...defaults(),
      transporterFactory: () => transport as never,
    });

    await provider.send({
      to: 'root@megatech.org',
      subject: 'Your Megatech login code',
      template: 'resetPasswordMailTemp',
      data: ['Root', '123456', 10],
    });

    const [options] = transport.sendMail.mock.calls[0] as [Record<string, unknown>];
    expect(options.html).toContain('123456');
  });
});

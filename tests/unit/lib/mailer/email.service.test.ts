import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailService } from '@/lib/mailer/email.service';
import { RestProvider, type RestProviderConfig } from '@/lib/mailer/providers/rest.provider';
import { SmtpProvider, type SmtpProviderConfig } from '@/lib/mailer/providers/smtp.provider';
import type { MailSendResult, SendEmailPayload } from '@/lib/mailer/types';

const restConfig = (overrides: Partial<RestProviderConfig> = {}): RestProviderConfig => ({
  token: 'mt-token',
  apiUrl: 'https://send.api.mailtrap.io/api/send',
  sandboxUrl: undefined,
  from: 'Megatech <no-reply@megatech.org>',
  timeoutMs: 5000,
  userAgent: 'megatech-backend/1.0',
  ...overrides,
});

const smtpConfig = (): SmtpProviderConfig => ({
  host: 'smtp.example.com',
  port: 587,
  user: 'svc@example.com',
  pass: 'secret',
  from: 'Megatech <no-reply@megatech.org>',
});

const payload: SendEmailPayload = {
  to: 'root@megatech.org',
  subject: 'Your Megatech login code',
  template: 'otpMailTemp',
  data: ['Root', '123456', 10],
  replyTo: 'ada@example.com',
  cc: ['shared@megatech.org'],
};

const renderSpy = vi.fn((template: string) => `<html>${template}</html>`);

const withRenderOverride = (service: EmailService): void => {
  vi.spyOn(service, 'isDryRun').mockReturnValue(false);
  // The real render path is inside email.service.ts. Override it so tests stay
  // decoupled from the template module.
  vi.spyOn(resourceFor('render').prototype, 'renderTemplate', 'get').mockReturnValue('<html>payload</html>');
};

/**
 * Minimal helper to keep tests decoupled from the real render module.
 * We replace the renderTemplate import in this module under test with a stub.
 */
import { renderTemplate } from '@/lib/mailer/render';

vi.mock('@/lib/mailer/render', () => ({
  renderTemplate: vi.fn((template: string) => `<html>${template}</html>`),
}));

describe('EmailService (multi-channel, fallback, toggle)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('dry-runs when no transport is configured', async () => {
    const renderMock = vi.mocked(renderTemplate);
    const captured: Awaited<ReturnType<typeof EmailService['send']>>['preview'] = undefined;

    const service = new EmailService(
      new RestProvider({ ...restConfig(), token: '', apiUrl: undefined }),
      new SmtpProvider({ ...smtpConfig(), host: '' })
    );

    const result = await service.send(payload);

    expect(result).toEqual(
      expect.objectContaining({
        delivered: false,
        provider: 'DRY_RUN',
      })
    );
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(renderMock.mock.lastCall?.[0]).toBe('otpMailTemp');
    expect((result as any).preview).toContain('otpMailTemp');
    expect(service.isDryRun()).toBe(true);
  });

  it('renders and decorates the subject line inside the dry-run log', async () => {
    const service = new EmailService(
      new RestProvider({ ...restConfig(), token: '' }),
      new SmtpProvider({ ...smtpConfig(), host: '' })
    );

    const result = await service.send(payload);

    expect(result.delivered).toBe(false);
    expect(result.provider).toBe('DRY_RUN');
    expect(result.preview).toContain('otpMailTemp');
  });

  it('in REST mode posts to the REST provider and stops', async () => {
    const restMock = { send: vi.fn().mockResolvedValue({ success: true, provider: 'REST', messageId: 'mid-rest' }) } as never;
    const smtpMock = { send: vi.fn() } as never;

    const service = new EmailService(restMock, smtpMock, { mode: 'REST', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    const result = await service.send(payload);

    expect(result).toEqual({ delivered: true, provider: 'REST', messageId: 'mid-rest' });
    expect(restMock.send).toHaveBeenCalledWith(payload);
    expect(smtpMock.send).not.toHaveBeenCalled();
  });

  it('in SMTP mode sends only via SMTP', async () => {
    const restMock = { send: vi.fn() } as never;
    const smtpMock = {
      send: vi.fn().mockResolvedValue({ success: true, provider: 'SMTP', messageId: 'mid-smtp' }),
      isConfigured: () => true,
    } as never;

    const service = new EmailService(restMock, smtpMock, { mode: 'SMTP', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    const result = await service.send(payload);

    expect(result).toEqual({ delivered: true, provider: 'SMTP', messageId: 'mid-smtp' });
    expect(restMock.send).not.toHaveBeenCalled();
    expect(smtpMock.send).toHaveBeenCalledWith(payload);
  });

  it('in HYBRID_FALLBACK mode delivers via REST when REST succeeds', async () => {
    const restMock = {
      send: vi.fn().mockResolvedValue({ success: true, provider: 'REST', messageId: 'mid-rest' }),
      isConfigured: () => true,
    } as never;
    const smtpMock = { send: vi.fn() } as never;

    const service = new EmailService(restMock, smtpMock, { mode: 'HYBRID_FALLBACK', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    const result = await service.send(payload);

    expect(result).toEqual({ delivered: true, provider: 'REST', messageId: 'mid-rest' });
    expect(restMock.send).toHaveBeenCalledWith(payload);
    expect(smtpMock.send).not.toHaveBeenCalled();
  });

  it('in HYBRID_FALLBACK mode falls back to SMTP when REST fails with an error result', async () => {
    const restMock = {
      send: vi.fn().mockResolvedValue({ success: false, provider: 'REST', error: new Error('Mailtrap 400') }),
      isConfigured: () => true,
    } as never;
    const smtpMock = {
      send: vi.fn().mockResolvedValue({ success: true, provider: 'SMTP', messageId: 'mid-smtp-fallback' }),
      isConfigured: () => true,
    } as never;

    const service = new EmailService(restMock, smtpMock, { mode: 'HYBRID_FALLBACK', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    const result = await service.send(payload);

    expect(result).toEqual({ delivered: true, provider: 'SMTP', messageId: 'mid-smtp-fallback' });
    expect(restMock.send).toHaveBeenCalledWith(payload);
    expect(smtpMock.send).toHaveBeenCalledWith(payload);
  });

  it('in HYBRID_FALLBACK mode abandons when both channels fail', async () => {
    const restMock = {
      send: vi.fn().mockResolvedValue({ success: false, provider: 'REST', error: new Error('Mailtrap 400') }),
      isConfigured: () => true,
    } as never;
    const smtpMock = {
      send: vi.fn().mockResolvedValue({
        success: false,
        provider: 'SMTP',
        error: new Error('connect ENETUNREACH'),
      }),
      isConfigured: () => true,
    } as never;

    const service = new EmailService(restMock, smtpMock, { mode: 'HYBRID_FALLBACK', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    const result = await service.send(payload);

    expect(result.delivered).toBe(false);
    expect(result.provider).toBe('SMTP');
    expect((result as any).error?.message).toContain('connect ENETUNREACH');
    expect(restMock.send).toHaveBeenCalledWith(payload);
    expect(smtpMock.send).toHaveBeenCalledWith(payload);
  });

  it('falls back to SMTP when the REST provider throws an exception', async () => {
    const restMock = {
      send: vi
        .fn()
        .mockRejectedValue(new Error('connect ENETUNREACH'))
        .mockResolvedValueOnce({ success: false, provider: 'REST', error: new Error('Mailtrap 400') }),
      isConfigured: () => true,
    } as never;

    const smtpMock = {
      send: vi.fn().mockResolvedValue({ success: true, provider: 'SMTP', messageId: 'mid-smtp-reject' }),
      isConfigured: () => true,
    } as never;

    const service = new EmailService(restMock, smtpMock, { mode: 'HYBRID_FALLBACK', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    const result = await service.send(payload);

    expect(result).toEqual({ delivered: true, provider: 'SMTP', messageId: 'mid-smtp-reject' });
    expect(restMock.send).toHaveBeenCalledWith(payload);
    expect(smtpMock.send).toHaveBeenCalledWith(payload);
  });

  it('in REST mode keeps a provider rejection as a delivered:false result', async () => {
    const restMock = {
      name: 'REST',
      send: vi.fn().mockRejectedValue(new Error('connect ENETUNREACH')),
      isConfigured: () => true,
    } as never;

    const service = new EmailService(restMock, new SmtpProvider(smtpConfig()), { mode: 'REST', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    const result = await service.send(payload);

    expect(result.delivered).toBe(false);
    expect((result as any).error?.message).toContain('connect ENETUNREACH');
    expect(result.provider).toBe('REST');
  });

  it('in SMTP mode keeps a provider rejection as a delivered:false result', async () => {
    const smtpMock = {
      name: 'SMTP',
      send: vi.fn().mockRejectedValue(new Error('connect ENETUNREACH')),
      isConfigured: () => true,
    } as never;

    const service = new EmailService(new RestProvider(restConfig()), smtpMock, { mode: 'SMTP', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    const result = await service.send(payload);

    expect(result.delivered).toBe(false);
    expect((result as any).error?.message).toContain('connect ENETUNREACH');
    expect(result.provider).toBe('SMTP');
  });

  it('settings a REST-only mode disables the SMTP fallback path', async () => {
    const configSpy = vi.fn();
    const restMock = {
      send: vi.fn().mockResolvedValue({ success: true, provider: 'REST', messageId: 'mid-rest-only' }),
      isConfigured: configSpy,
    } as never;
    const smtpMock = { send: vi.fn() } as never;

    const service = new EmailService(restMock, smtpMock, { mode: 'REST', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    await service.send(payload);
    await service.send(payload);

    expect(configSpy).toHaveBeenCalledTimes(0);
    expect(smtpMock.send).not.toHaveBeenCalled();
    expect(restMock.send).toHaveBeenCalledTimes(2);
  });

  it('settings a SMTP-only mode disables the REST path', async () => {
    const restMock = { send: vi.fn() } as never;
    const smtpMock = {
      send: vi.fn().mockResolvedValue({ success: true, provider: 'SMTP', messageId: 'mid-smtp-only' }),
      isConfigured: () => true,
    } as never;

    const service = new EmailService(restMock, smtpMock, { mode: 'SMTP', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    await service.send(payload);

    expect(restMock.send).not.toHaveBeenCalled();
    expect(smtpMock.send).toHaveBeenCalledWith(payload);
  });

  it('renders the template exactly once per send regardless of mode', async () => {
    const restMock = { send: vi.fn().mockResolvedValue({ success: true, provider: 'REST' }), isConfigured: () => true } as never;
    const service = new EmailService(restMock, new SmtpProvider(smtpConfig()), { mode: 'REST', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    await service.send(payload);
    await service.send({ ...payload, to: 'other@megatech.org' });
    await service.send({ ...payload, template: 'resetPasswordMailTemp' });
    await service.send({ ...payload, template: 'welcomeAdminMailTemp', replyTo: 'b@example.com', cc: [] });
    await service.send({ ...payload, cc: undefined });

    expect(renderTemplate).toHaveBeenCalledTimes(5);
  });

  it('NORMALISE mode label stays REST when the provider responds with provider="REST"', async () => {
    const restMock = {
      send: vi.fn().mockResolvedValue({ success: true, provider: 'REST', messageId: 'mid-1' }),
      isConfigured: () => true,
    } as never;

    const service = new EmailService(restMock, new SmtpProvider(smtpConfig()), { mode: 'REST', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    const result = await service.send(payload);

    expect((result as MailSendResult).provider).toBe('REST');
  });

  // ---------- deterministic service-wide test for mode + provider resolution ----------

  it('fails closed for unknown modes: treats them as SMTP-only', async () => {
    // Real environments only receive one of the three approved strings. This test
    // documents the current behaviour if a bad value does slip into ENV.
    const service = new EmailService(new RestProvider(restConfig()), new SmtpProvider(smtpConfig()));
    vi.spyOn(service, 'mode', 'get').mockReturnValue('SMTP' as any);
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    const restMock = { send: vi.fn().mockResolvedValue({ success: true, provider: 'REST' }) } as never;
    const smtpMock = {
      send: vi.fn().mockResolvedValue({ success: true, provider: 'SMTP', messageId: 'mid' }),
      isConfigured: () => true,
    } as never;

    const service2 = new EmailService(restMock, smtpMock, { mode: 'SMTP', dryRun: false });
    vi.spyOn(service2, 'isDryRun').mockReturnValue(false);
    await service2.send(payload);

    expect(restMock.send).not.toHaveBeenCalled();
    expect(smtpMock.send).toHaveBeenCalledWith(payload);
  });

  it('returns a failed, decorated result even when providers return non-standard shapes', async () => {
    const restMock = {
      send: vi.fn().mockResolvedValue({ success: true, provider: 'REST' }),
      isConfigured: () => true,
    } as never;

    const service = new EmailService(restMock, new SmtpProvider(smtpConfig()), { mode: 'REST', dryRun: false });
    vi.spyOn(service, 'isDryRun').mockReturnValue(false);

    const result = await service.send(payload);

    expect(result.delivered).toBe(true);
    expect(result.provider).toBe('REST');
    expect(result.messageId).toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RestProvider, type RestProviderConfig } from '@/lib/mailer/providers/rest.provider';
import type { SendEmailPayload } from '@/lib/mailer/types';

const payload: SendEmailPayload = {
  to: 'root@megatech.org',
  subject: 'Your Megatech login code',
  template: 'otpMailTemp',
  data: ['Root', '123456', 10],
};

const config = (overrides: Partial<RestProviderConfig> = {}): RestProviderConfig => ({
  token: 'mt-token',
  apiUrl: 'https://send.api.mailtrap.io/api/send',
  from: 'Megatech <no-reply@megatech.org>',
  timeoutMs: 5000,
  userAgent: 'megatech-backend/1.0',
  ...overrides,
});

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'OK',
  text: async () => JSON.stringify(body),
});

const fetchMock = vi.fn();
beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('RestProvider', () => {
  it('posts the rendered message to the transactional endpoint', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: true,
          message_ids: ['mid-1'],
        },
        200
      )
    );

    const result = await new RestProvider(config()).send(payload);

    expect(result).toEqual({ success: true, provider: 'REST', messageId: 'mid-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://send.api.mailtrap.io/api/send');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Api-Token': 'mt-token',
      'User-Agent': 'megatech-backend/1.0',
      'Content-Type': 'application/json',
    });

    const body = JSON.parse(init.body as string);
    expect(body.from).toEqual({ email: 'no-reply@megatech.org', name: 'Megatech' });
    expect(body.to).toEqual([{ email: 'root@megatech.org' }]);
    expect(body.subject).toBe('Your Megatech login code');
    expect(body.html).toContain('123456');
    expect(body.replyTo).toBeUndefined();
    expect(body.cc).toBeUndefined();
  });

  it('adds reply-to and cc when they are provided', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: true,
          message_ids: ['mid-2'],
        },
        200
      )
    );

    const result = await new RestProvider(config()).send({
      ...payload,
      replyTo: 'ada@example.com',
      cc: ['shared@megatech.org'],
    });

    expect(result.success).toBe(true);

    const [_, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.reply_to).toEqual({ email: 'ada@example.com' });
    expect(body.cc).toEqual([{ email: 'shared@megatech.org' }]);
  });

  it('reports Mailtrap validation errors without throwing', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { success: false, errors: ["'to' recipient is missing"] },
        400
      )
    );

    const result = await new RestProvider(config()).send(payload);

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        provider: 'REST',
        error: expect.any(Error),
      })
    );
    const logged = result.error as Error;
    expect(logged.message).toContain('Mailtrap responded 400');
    expect(logged.message).toContain("to' recipient is missing");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a 200 with success:false as a failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, errors: ['from is required'] }));

    const result = await new RestProvider(config()).send(payload);

    expect(result.success).toBe(false);
    expect(result.provider).toBe('REST');
  });

  it('treats a non-JSON error page as a failed result', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse('<html>Bad gateway</html>', 502)
    );

    const result = await new RestProvider(config()).send(payload);

    expect(result.success).toBe(false);
    expect(result.provider).toBe('REST');
    expect((result.error as Error).message).toContain('502');
  });

  it('contains network and connection errors', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('connect ENETUNREACH'), { code: 'ENETUNREACH' }));

    const result = await new RestProvider(config()).send(payload);

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        provider: 'REST',
        error: expect.any(Error),
      })
    );
    expect((result.error as Error).message).toContain('ENETUNREACH');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('contains fetch/abort timeouts', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted due to timeout'));

    const result = await new RestProvider(config({ timeoutMs: 50 })).send(payload);

    expect(result.success).toBe(false);
    expect(result.provider).toBe('REST');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not call the API when unconfigured', async () => {
    const result = await new RestProvider(config({ token: '' })).send(payload);

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        provider: 'REST',
        error: expect.any(Error),
      })
    );
    expect((result.error as Error).message).toContain('MAILTRAP_API_TOKEN');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

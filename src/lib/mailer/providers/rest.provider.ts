import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { parseMailAddress } from '../address';
import { renderTemplate } from '../render';
import type { IMailProvider, MailProviderResult, SendEmailPayload } from '../types';

/** Everything the provider needs, injectable so tests never touch the network. */
export interface RestProviderConfig {
  token: string;
  /** Full transactional endpoint, e.g. `https://send.api.mailtrap.io/api/send`. */
  apiUrl: string;
  from: string;
  timeoutMs: number;
  /** Mailtrap's edge protection blocks requests without a normal User-Agent. */
  userAgent: string;
}

export const restConfigFromEnv = (): RestProviderConfig => ({
  token: ENV.MAILTRAP_API_TOKEN,
  apiUrl: ENV.MAILTRAP_API_URL,
  from: ENV.MAIL_FROM,
  timeoutMs: ENV.EMAIL_REST_TIMEOUT_MS,
  userAgent: ENV.EMAIL_REST_USER_AGENT,
});

/** Mailtrap's request body (https://send.api.mailtrap.io/api/send). */
export interface MailtrapSendBody {
  from: { email: string; name?: string };
  to: { email: string }[];
  subject: string;
  html: string;
  reply_to?: { email: string };
  cc?: { email: string }[];
}

/** Mailtrap's success shape. */
interface MailtrapResponseBody {
  success?: boolean;
  message_ids?: string[];
  errors?: string[];
}

const describeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

/**
 * REST transport (Mailtrap Email Sending API).
 *
 * This is the primary delivery channel. Any HTTP, timeout or network failure is
 * returned as a failed `MailProviderResult` so the `EmailService` can fall back
 * to SMTP instead of failing the caller.
 */
export class RestProvider implements IMailProvider {
  public readonly name = 'REST' as const;

  constructor(private readonly config: RestProviderConfig = restConfigFromEnv()) {}

  public isConfigured(): boolean {
    return Boolean(this.config.token && this.config.apiUrl);
  }

  public endpoint(): string {
    return this.config.apiUrl;
  }

  /** Maps a rendered message onto Mailtrap's payload shape. */
  private buildBody(payload: SendEmailPayload, html: string): MailtrapSendBody {
    const body: MailtrapSendBody = {
      from: parseMailAddress(this.config.from),
      to: [{ email: payload.to }],
      subject: payload.subject,
      html,
    };

    if (payload.replyTo) body.reply_to = { email: payload.replyTo };
    if (payload.cc && payload.cc.length > 0) body.cc = payload.cc.map((email) => ({ email }));

    return body;
  }

  public async send(payload: SendEmailPayload): Promise<MailProviderResult> {
    const endpoint = this.endpoint();

    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          provider: this.name,
          error: new Error('REST transport is not configured (MAILTRAP_API_TOKEN missing)'),
        };
      }

      const body = this.buildBody(payload, renderTemplate(payload.template, payload.data));
      logger.debug(`[rest-provider] POST ${endpoint} → ${payload.to} (template=${payload.template})`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          // Mailtrap accepts either auth header; `Api-Token` is the documented one.
          'Api-Token': this.config.token,
          'User-Agent': this.config.userAgent,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      const raw = await response.text();
      let parsed: MailtrapResponseBody = {};
      try {
        parsed = raw ? (JSON.parse(raw) as MailtrapResponseBody) : {};
      } catch {
        // Non-JSON error page (edge protection, proxy, …) — keep the raw body.
        parsed = {};
      }

      if (!response.ok || parsed.success === false) {
        const details = parsed.errors?.join('; ') || raw.slice(0, 300) || response.statusText;
        logger.error(`[rest-provider] HTTP ${response.status} for ${payload.to}`, { status: response.status, details, raw });
        return {
          success: false,
          provider: this.name,
          error: new Error(`Mailtrap responded ${response.status}: ${details}`),
        };
      }

      const messageId = parsed.message_ids?.[0];
      logger.debug(`[rest-provider] Delivered via REST to ${payload.to}${messageId ? ` (id=${messageId})` : ''}`);

      return { success: true, provider: this.name, messageId };
    } catch (error) {
      // Covers DNS failures, ENETUNREACH, TLS errors and AbortSignal timeouts.
      logger.error(`[rest-provider] Delivery failed for ${payload.to}`, error);
      return { success: false, provider: this.name, error };
    }
  }
}

export default RestProvider;
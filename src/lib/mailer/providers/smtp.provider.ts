import nodemailer from 'nodemailer';
import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { renderTemplate } from '../render';
import type { IMailProvider, MailProviderResult, SendEmailPayload } from '../types';

/**
 * Minimal structural view of the Nodemailer surface this provider uses.
 *
 * Declared locally on purpose: the installed `@types/nodemailer` entry file in
 * this environment is truncated (it exports nothing), so relying on its named
 * exports such as `Transporter` / `SentMessageInfo` would not compile. The
 * shapes below match Nodemailer's real API and keep this provider independent of
 * the state of that types package.
 */
export interface SmtpSendResult {
  messageId?: string;
}

export interface SmtpTransporter {
  sendMail(options: Record<string, unknown>): Promise<SmtpSendResult>;
}

interface NodemailerModule {
  createTransport(config: Record<string, unknown>): SmtpTransporter;
}

const nodemailerLib = nodemailer as unknown as NodemailerModule;

/** Everything the provider needs, injectable so tests never touch the network. */
export interface SmtpProviderConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  /** Injected in tests; defaults to a lazily created nodemailer transport. */
  transporterFactory?: () => SmtpTransporter | null;
}

export const smtpConfigFromEnv = (): SmtpProviderConfig => ({
  host: ENV.SMTP_HOST,
  port: Number(ENV.SMTP_PORT) || (ENV.NODE_ENV === 'production' ? 465 : 587),
  user: ENV.SMTP_USER,
  pass: ENV.SMTP_PASS,
  from: ENV.MAIL_FROM,
});

/** Turns any thrown value into a loggable description without losing detail. */
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
 * SMTP transport (Nodemailer).
 *
 * Serves both as the primary channel in `EMAIL_DELIVERY_MODE=SMTP` and as the
 * automatic fallback for the REST channel in `HYBRID_FALLBACK` mode. Network
 * and auth failures (`ENETUNREACH`, timeouts, ...) are reported as a failed
 * `MailProviderResult` rather than thrown.
 */
export class SmtpProvider implements IMailProvider {
  public readonly name = 'SMTP' as const;

  private transporter: SmtpTransporter | null = null;

  constructor(private readonly config: SmtpProviderConfig = smtpConfigFromEnv()) {}

  public isConfigured(): boolean {
    if (this.config.transporterFactory) return true;
    return Boolean(this.config.host);
  }

  private getTransporter(): SmtpTransporter | null {
    if (this.config.transporterFactory) return this.config.transporterFactory();
    if (!this.config.host) return null;

    if (!this.transporter) {
      this.transporter = nodemailerLib.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.port === 465,
        auth: this.config.user ? { user: this.config.user, pass: this.config.pass } : undefined,
        tls: {
          // Do not fail on invalid / self-signed certs in local dev
          family: 4,
        },
      });
    }
    return this.transporter;
  }

  public async send(payload: SendEmailPayload): Promise<MailProviderResult> {
    try {
      const transporter = this.getTransporter();
      if (!transporter) {
        return {
          success: false,
          provider: this.name,
          error: new Error('SMTP transport is not configured (SMTP_HOST missing)'),
        };
      }

      const info = await transporter.sendMail({
        from: this.config.from,
        to: payload.to,
        subject: payload.subject,
        html: renderTemplate(payload.template, payload.data),
        replyTo: payload.replyTo,
        cc: payload.cc,
      });

      const messageId = typeof info?.messageId === 'string' ? info.messageId : undefined;
      logger.debug(`[smtp-provider] Delivered via SMTP to ${payload.to}${messageId ? ` (id=${messageId})` : ''}`);

      return { success: true, provider: this.name, messageId };
    } catch (error) {
      logger.error(`[smtp-provider] Delivery failed for ${payload.to}`, error);
      return { success: false, provider: this.name, error };
    }
  }
}

export default SmtpProvider;

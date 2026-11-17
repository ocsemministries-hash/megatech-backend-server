import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { captureMail } from './capture';
import { renderTemplate } from './render';
import { RestProvider } from './providers/rest.provider';
import { SmtpProvider } from './providers/smtp.provider';
import type {
  EmailDeliveryMode,
  IMailProvider,
  MailProviderResult,
  MailSendResult,
  MailTemplateKey,
  SendEmailPayload,
} from './types';

export interface EmailServiceOptions {
  /** Defaults to `ENV.EMAIL_DELIVERY_MODE`. */
  mode?: EmailDeliveryMode;
  /**
   * Force the render-and-capture path on or off. When omitted it is detected:
   * test runs and environments with no transport configured are dry-run.
   */
  dryRun?: boolean;
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
 * Unified mail delivery facade.
 *
 * Callers (usecases, event handlers, controllers) only ever see this class, so
 * the transport (REST vs SMTP) and the vendor (Mailtrap, ...) stay swappable via
 * configuration. Delivery strategy:
 *
 * - `REST`            -> Mailtrap REST API only.
 * - `SMTP`            -> Nodemailer only.
 * - `HYBRID_FALLBACK` -> REST first, SMTP if REST fails (default).
 *
 * When nothing is configured (test runs, or local dev without credentials) the
 * message is rendered and captured in memory instead, so no flow breaks.
 */
export class EmailService {
  public readonly mode: EmailDeliveryMode;

  private readonly dryRunOverride?: boolean;

  constructor(
    private readonly rest: IMailProvider = new RestProvider(),
    private readonly smtp: IMailProvider = new SmtpProvider(),
    options: EmailServiceOptions = {}
  ) {
    this.mode = options.mode ?? ENV.EMAIL_DELIVERY_MODE;
    this.dryRunOverride = options.dryRun;
  }

  /** No transport is usable -> render + capture rather than attempt a send. */
  public isDryRun(): boolean {
    if (this.dryRunOverride !== undefined) return this.dryRunOverride;
    if (ENV.NODE_ENV === 'test') return true;
    return !this.rest.isConfigured() && !this.smtp.isConfigured();
  }

  private toResult(result: MailProviderResult): MailSendResult {
    return {
      delivered: result.success,
      provider: result.provider,
      ...(result.messageId !== undefined ? { messageId: result.messageId } : {}),
      ...(result.error !== undefined ? { error: result.error } : {}),
    };
  }

  /**
   * Runs one provider attempt and normalises a rejection into a failed result,
   * so a misbehaving transport still triggers the configured fallback.
   */
  private async attempt(provider: IMailProvider, payload: SendEmailPayload): Promise<MailProviderResult> {
    try {
      return await provider.send(payload);
    } catch (error) {
      logger.error(`[email-service] ${provider.name} provider rejected unexpectedly:`, error);
      return { success: false, provider: provider.name, error };
    }
  }

  private dryRun<K extends MailTemplateKey>(payload: SendEmailPayload<K>, html: string): MailSendResult {
    logger.info(`[mailer:dry-run] to=${payload.to} subject="${payload.subject}" template=${payload.template}`);
    captureMail({
      to: payload.to,
      subject: payload.subject,
      html,
      template: payload.template,
      replyTo: payload.replyTo,
      cc: payload.cc,
    });
    return { delivered: false, preview: html, provider: 'DRY_RUN' };
  }

  /** Sends one message through the configured channel(s). Never throws. */
  public async send<K extends MailTemplateKey>(payload: SendEmailPayload<K>): Promise<MailSendResult> {
    try {
      const html = renderTemplate(payload.template, payload.data);

      if (this.isDryRun()) return this.dryRun(payload, html);

      logger.debug(`[email-service] Dispatching "${payload.template}" to ${payload.to} (mode=${this.mode})`);

      if (this.mode === 'REST') {
        return this.toResult(await this.attempt(this.rest, payload));
      }

      if (this.mode === 'SMTP') {
        return this.toResult(await this.attempt(this.smtp, payload));
      }

      // HYBRID_FALLBACK - the REST channel is primary.
      const primary = await this.attempt(this.rest, payload);
      if (primary.success) return this.toResult(primary);

      logger.warn(
        `[email-service] Primary REST channel failed, switching to SMTP fallback... (${describeError(primary.error)})`
      );

      const fallback = await this.attempt(this.smtp, payload);
      if (fallback.success) {
        logger.info(`[email-service] SMTP fallback delivered "${payload.template}" to ${payload.to}`);
        return this.toResult(fallback);
      }

      logger.error(
        `[email-service] All channels failed for ${payload.to} (REST: ${describeError(primary.error)} | SMTP: ${describeError(
          fallback.error
        )})`
      );

      return { delivered: false, provider: fallback.provider, error: fallback.error ?? primary.error };
    } catch (error) {
      // Rendering/validation problems must not surface as rejections either.
      logger.error(`[email-service] Unexpected failure while sending to ${payload.to}:`, error);
      return { delivered: false, error };
    }
  }
}

export const emailService = new EmailService();

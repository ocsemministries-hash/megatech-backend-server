import { clearCapturedMails, getCapturedMails } from './capture';
import { renderTemplate } from './render';
import { emailService } from './email.service';
import type { CapturedMail, MailSendResult, MailTemplateData, MailTemplateKey, SendEmailPayload } from './types';

export { clearCapturedMails, getCapturedMails, renderTemplate };
export type { CapturedMail, MailTemplateData, MailTemplateKey, MailSendResult };

/**
 * Backwards-compatible alias for {@link SendEmailPayload}.
 *
 * Kept because module usecases (and their tests) inject a mail sender typed with
 * this name.
 */
export type SendMailInput<K extends MailTemplateKey = MailTemplateKey> = SendEmailPayload<K>;

/**
 * Single entry point for outbound mail.
 *
 * This is now a thin delegation to the EmailService, which owns channel
 * selection (REST / SMTP / hybrid fallback) and rendering. It resolves with
 * `delivered: false` instead of rejecting when no transport is configured or
 * every channel fails, so background event handlers can never crash the
 * process through an unhandled rejection.
 */
export const sendMail = <K extends MailTemplateKey>(input: SendMailInput<K>): Promise<MailSendResult> =>
  emailService.send(input);

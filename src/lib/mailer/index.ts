export * from './mailer';
export * as templates from './templates';

// Multi-channel delivery layer: callers only need `sendMail` (re-exported via
// ./mailer), while these exports stay available for wiring and tests.
export { EmailService, emailService } from './email.service';
export { RestProvider, restConfigFromEnv } from './providers/rest.provider';
export type { RestProviderConfig } from './providers/rest.provider';
export { SmtpProvider, smtpConfigFromEnv } from './providers/smtp.provider';
export type { SmtpProviderConfig } from './providers/smtp.provider';
export { parseMailAddress } from './address';
export { captureMail } from './capture';
export type { MailAddress } from './address';
export type {
  EmailDeliveryMode,
  IMailProvider,
  MailProviderName,
  MailProviderResult,
  SendEmailPayload,
} from './types';

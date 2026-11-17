import * as templates from './templates';

/** Every template the mailer can render (key of the templates barrel). */
export type MailTemplateKey = keyof typeof templates;

/** Strongly-typed argument tuple for a given template. */
export type MailTemplateData<K extends MailTemplateKey> = Parameters<(typeof templates)[K]>;

/** How `EmailService` chooses (and falls back between) transports. */
export type EmailDeliveryMode = 'REST' | 'SMTP' | 'HYBRID_FALLBACK';

/** Concrete transport names that can actually deliver a message. */
export type MailProviderName = 'REST' | 'SMTP';

/**
 * Transport-agnostic outbound message.
 *
 * `template`/`data` are rendered to HTML by the active provider, so the vendor
 * and the transport (HTTP vs SMTP) stay invisible to callers.
 *
 * Note: this is a deliberate superset of the base spec — it carries the full
 * template union (the app ships four templates, not three) plus the optional
 * `replyTo`/`cc` fields callers can use for shared inboxes.
 */
export interface SendEmailPayload<K extends MailTemplateKey = MailTemplateKey> {
  to: string;
  subject: string;
  template: K;
  data: MailTemplateData<K>;
  /** Optional Reply-To address, e.g. the submitter of a public form. */
  replyTo?: string;
  /** Optional CC recipients, e.g. a shared inbox. */
  cc?: string[];
}

/** What a transport provider reports back after an attempt. */
export interface MailProviderResult {
  success: boolean;
  provider: MailProviderName;
  messageId?: string;
  error?: unknown;
}

/** Every transport implements this contract. `send` must never throw. */
export interface IMailProvider {
  readonly name: MailProviderName;
  /** True when the provider has enough configuration to be attempted. */
  isConfigured(): boolean;
  send(payload: SendEmailPayload): Promise<MailProviderResult>;
}

/** A message captured in memory instead of being sent over the wire. */
export interface CapturedMail {
  to: string;
  subject: string;
  html: string;
  template: string;
  replyTo?: string;
  cc?: string[];
}

/** Public result of a `sendMail` call. */
export interface MailSendResult {
  /** True only when a transport actually accepted the message. */
  delivered: boolean;
  /** Rendered HTML, returned by the dry-run path so callers can preview it. */
  preview?: string;
  provider?: MailProviderName | 'DRY_RUN';
  messageId?: string;
  error?: unknown;
}
import type { CapturedMail } from './types';

/**
 * In-memory sink for messages that were rendered but never handed to a
 * transport (test mode, or dev without credentials configured).
 *
 * Lives in its own module so both the mailer facade and `EmailService` can
 * read/write it without importing each other.
 */
const capturedMails: CapturedMail[] = [];

/** Test/dev helper: mails "sent" while every transport was disabled. */
export const getCapturedMails = (): readonly CapturedMail[] => capturedMails;

export const clearCapturedMails = (): void => {
  capturedMails.length = 0;
};

export const captureMail = (mail: CapturedMail): void => {
  capturedMails.push(mail);
};
/** A parsed RFC-5322 style address. */
export interface MailAddress {
  email: string;
  name?: string;
}

/**
 * Parses `"Name <email@host>"` into its parts.
 *
 * Mailtrap's REST API and SMTP both need the display name and the address
 * separately, while configuration stores them as a single `MAIL_FROM` string.
 */
export const parseMailAddress = (raw: string): MailAddress => {
  const value = (raw ?? '').trim();
  const match = /^(.*?)\s*<\s*([^>]+)\s*>$/.exec(value);

  if (match) {
    const name = match[1].replace(/^"|"$/g, '').trim();
    return { email: match[2].trim(), ...(name ? { name } : {}) };
  }

  return { email: value };
};
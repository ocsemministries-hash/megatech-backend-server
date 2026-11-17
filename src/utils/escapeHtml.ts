/**
 * Escapes characters that would otherwise be interpreted as HTML markup.
 *
 * Every value rendered into an email template may originate from user input,
 * so it must never be interpolated raw into HTML.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

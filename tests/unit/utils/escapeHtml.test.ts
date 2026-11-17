import { describe, expect, it } from 'vitest';
import { escapeHtml } from '@/utils/escapeHtml';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml('<script>alert("x" & \'y\')</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands before anything else', () => {
    // If & were replaced last, the introduced entities would be double-escaped.
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('returns an empty string for nullish input', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('renders numbers as-is', () => {
    expect(escapeHtml(25)).toBe('25');
    expect(escapeHtml(0)).toBe('0');
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtml('12 Marina Road, Lagos')).toBe('12 Marina Road, Lagos');
  });
});
import * as templates from './templates';
import type { MailTemplateData, MailTemplateKey } from './types';

/** Renders the chosen template to its HTML string. */
export const renderTemplate = <K extends MailTemplateKey>(
  template: K,
  data: MailTemplateData<K>
): string => (templates[template] as (...args: unknown[]) => string)(...(data as unknown[]));
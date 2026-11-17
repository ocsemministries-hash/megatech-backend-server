import { eventBus } from './event-bus';
import { logger } from '@/utils/logger';
import { registerAuthEventListeners } from '@/modules/auth/auth.events';
import { registerUserAuthEventListeners } from '@/modules/userAuth/userAuth.events';
import { registerAdminEventListeners } from '@/modules/admin/admin.events';
import { registerNewsletterEventListeners } from '@/modules/admin/admin.newsletter.events';
import { registerAuditEventListeners } from '@/modules/audit/audit.events';

// Module event files import the bus from './event-bus' directly so registering
// listeners here cannot create a circular import back into this barrel.

let initialized = false;

/**
 * Wires every module's background listeners onto the shared event bus.
 *
 * Must run before the server accepts traffic (see `src/app.ts`).
 * Idempotent, so bootstrapping may also be triggered from test setup.
 */
export const initializeEventListeners = (): void => {
  if (initialized) return;

  registerAuthEventListeners();
  registerUserAuthEventListeners();
  registerAdminEventListeners();
  registerNewsletterEventListeners();
  registerAuditEventListeners();

  initialized = true;
  logger.info('✅ All background event listeners initialized.');
};

export { eventBus };

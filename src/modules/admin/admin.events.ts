import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { sendMail } from '@/lib/mailer/mailer';
import { eventBus } from '@/lib/events/event-bus';

// 1. Event Keys
export const ADMIN_EVENTS = {
  INVITE_CREATED: 'admin.invite_created',
  INVITE_ACCEPTED: 'admin.invite_accepted',
} as const;

// 2. Payload Types
export interface InviteCreatedPayload {
  actorName: string;
  adminId: string;
  email: string;
  roleName: string;
  /** Single-use accept link containing the raw invite token. */
  inviteUrl: string;
  expiresInHours: number;
}

export interface InviteAcceptedPayload {
  adminId: string;
  email: string;
  firstName: string;
}

// 3. Handlers (Always handle errors internally so background failures don't crash Node)
const handleInviteCreated = async (payload: InviteCreatedPayload): Promise<void> => {
  try {
    const mail = await sendMail({
      to: payload.email,
      subject: 'You are invited to Megatech admin',
      template: 'adminInviteMailTemp',
      data: [payload.actorName, payload.email, payload.inviteUrl, payload.roleName, payload.expiresInHours],
    });

    if (!mail.delivered) {
      logger.warn(`[admin:events] Invite mail delivery failed for ${payload.email}`);
    } else {
      logger.info(`[admin:events] Invite mail sent to ${payload.email} as ${payload.roleName}`);
    }
  } catch (error) {
    logger.error(`[admin:events] Failed to send invite mail to ${payload.email}:`, error);
  }
};

const handleInviteAccepted = async (payload: InviteAcceptedPayload): Promise<void> => {
  try {
    const mail = await sendMail({
      to: payload.email,
      subject: 'Welcome to Megatech',
      template: 'welcomeAdminMailTemp',
      data: [payload.firstName, ENV.ADMIN_WEB_URL],
    });

    if (!mail.delivered) {
      logger.warn(`[admin:events] Welcome mail delivery failed for ${payload.email}`);
    }
  } catch (error) {
    logger.error(`[admin:events] Failed to send welcome mail to ${payload.email}:`, error);
  }
};

// 4. Registration Entry Point
export const registerAdminEventListeners = (): void => {
  eventBus.safeOn<InviteCreatedPayload>(ADMIN_EVENTS.INVITE_CREATED, handleInviteCreated);
  eventBus.safeOn<InviteAcceptedPayload>(ADMIN_EVENTS.INVITE_ACCEPTED, handleInviteAccepted);
};

export { handleInviteCreated, handleInviteAccepted };
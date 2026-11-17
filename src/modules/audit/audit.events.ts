import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';
import { eventBus } from '@/lib/events/event-bus';
import { AuditLogRepository } from '@/lib/dal/repositories/auditLog/auditLog.repository';
import type { CreateAuditLogInput } from '@/lib/dal/repositories/auditLog/auditLog.schema';

// 1. Event Keys
export const AUDIT_EVENTS = {
  RECORD_REQUESTED: 'audit.record_requested',
} as const;

// 2. Payload Types
export interface AuditRecordRequestedPayload {
  action: string;
  actorId?: string | null;
  actorType?: string;
  resource?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Minimal writer contract, so the handler can be unit-tested with a fake. */
export type AuditLogWriter = Pick<AuditLogRepository, 'record'>;

/** Rows captured instead of persisted while running without a database. */
const capturedAudits: AuditRecordRequestedPayload[] = [];

/** Test/dev helper: audit rows recorded while persistence was skipped. */
export const getCapturedAudits = (): readonly AuditRecordRequestedPayload[] => capturedAudits;

export const clearCapturedAudits = (): void => {
  capturedAudits.length = 0;
};

/**
 * Mirrors the mailer's dry-run behaviour: without a database (tests) audit rows
 * are captured in memory rather than sent to Prisma.
 */
const getAuditWriter = (): AuditLogWriter => {
  if (ENV.NODE_ENV === 'test') {
    return {
      record: async (input: CreateAuditLogInput) => {
        capturedAudits.push(input);
        return input as never;
      },
    };
  }
  return new AuditLogRepository();
};

// 3. Handlers
const handleAuditRecordRequested = async (
  payload: AuditRecordRequestedPayload,
  writer: AuditLogWriter = getAuditWriter()
): Promise<void> => {
  try {
    await writer.record({
      actorId: payload.actorId ?? null,
      actorType: payload.actorType ?? 'ADMIN',
      action: payload.action,
      resource: payload.resource ?? null,
      meta: payload.meta ?? null,
      ip: payload.ip ?? null,
      userAgent: payload.userAgent ?? null,
    });
    logger.debug(`[audit:events] Recorded action ${payload.action}`);
  } catch (error) {
    logger.error(`[audit:events] Failed to persist audit action ${payload.action}:`, error);
  }
};

/** Fire-and-forget audit trail: never blocks or fails the caller. */
export const recordAudit = (payload: AuditRecordRequestedPayload): boolean =>
  eventBus.safeEmit<AuditRecordRequestedPayload>(AUDIT_EVENTS.RECORD_REQUESTED, payload);

// 4. Registration Entry Point
export const registerAuditEventListeners = (): void => {
  eventBus.safeOn<AuditRecordRequestedPayload>(AUDIT_EVENTS.RECORD_REQUESTED, handleAuditRecordRequested);
};

export { handleAuditRecordRequested };
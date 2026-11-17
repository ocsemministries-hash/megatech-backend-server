import type { Request } from 'express';
import type { AdminActor } from '@/lib/security/principal';
import type { CreateAuditLogInput } from '@/lib/dal/repositories/auditLog/auditLog.schema';

export interface AdminAuditContext {
  actor: AdminActor;
  ip: string | null;
  userAgent: string | null;
}

/** Builds the audit context from an authenticated admin request (req.ip honours `trust proxy`). */
export const adminAuditContext = (req: Request): AdminAuditContext => ({
  actor: req.admin!,
  ip: req.ip ?? null,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});

/** Shapes one audit row from the request context; used by every admin media/live mutation. */
export const toAuditInput = (
  ctx: AdminAuditContext,
  action: string,
  resource: string,
  meta: Record<string, unknown>
): CreateAuditLogInput => ({
  action,
  actorId: ctx.actor.id,
  actorType: 'ADMIN',
  resource,
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  meta: { ...meta, actorEmail: ctx.actor.email },
});

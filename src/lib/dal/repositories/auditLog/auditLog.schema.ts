export interface CreateAuditLogInput {
  actorId?: string | null;
  actorType?: string;
  action: string;
  resource?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

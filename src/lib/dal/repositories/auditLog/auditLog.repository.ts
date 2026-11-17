import type { AuditLog, Prisma } from '@prisma/client';
import { prisma } from '../../base/prisma.client';
import { BaseRepository } from '../../base/base.repository';
import type { ModelDelegate } from '../../base/base.repository.types';
import type { DbClient } from '../../base/transaction';
import type { CreateAuditLogInput } from './auditLog.schema';

export class AuditLogRepository extends BaseRepository<AuditLog, CreateAuditLogInput, { actorId?: string | null }> {
  constructor() {
    super(prisma.auditLog as unknown as ModelDelegate<AuditLog>);
  }

  /** Writes one audit row, joining the caller's transaction when `db` is given. */
  async record(input: CreateAuditLogInput, db: DbClient = prisma): Promise<AuditLog> {
    return db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorType: input.actorType ?? 'ADMIN',
        action: input.action,
        resource: input.resource ?? null,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }
}

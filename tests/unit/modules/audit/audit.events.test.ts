import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCapturedAudits,
  getCapturedAudits,
  handleAuditRecordRequested,
  recordAudit,
} from '@/modules/audit/audit.events';

describe('handleAuditRecordRequested', () => {
  it('persists the audit row through the injected writer', async () => {
    const writer = { record: vi.fn(async () => ({ id: 'log-1' })) };

    await handleAuditRecordRequested(
      {
        action: 'admin.invited',
        actorId: 'admin-1',
        resource: 'admin:admin-2',
        meta: { email: 'grace@megatech.org' },
      },
      writer as never
    );

    expect(writer.record).toHaveBeenCalledWith({
      actorId: 'admin-1',
      actorType: 'ADMIN',
      action: 'admin.invited',
      resource: 'admin:admin-2',
      meta: { email: 'grace@megatech.org' },
      ip: null,
      userAgent: null,
    });
  });

  it('defaults the actor type and nulls out omitted optional fields', async () => {
    const writer = { record: vi.fn(async () => ({ id: 'log-2' })) };

    await handleAuditRecordRequested({ action: 'auth.password.reset' }, writer as never);

    expect(writer.record).toHaveBeenCalledWith({
      actorId: null,
      actorType: 'ADMIN',
      action: 'auth.password.reset',
      resource: null,
      meta: null,
      ip: null,
      userAgent: null,
    });
  });

  it('swallows writer failures so background audits cannot break the request path', async () => {
    const writer = {
      record: vi.fn(async () => {
        throw new Error('database unavailable');
      }),
    };

    await expect(handleAuditRecordRequested({ action: 'auth.login.succeeded' }, writer as never)).resolves.toBeUndefined();
  });
});

describe('audit event bus wiring', () => {
  beforeEach(() => {
    clearCapturedAudits();
  });

  it('records audit rows in memory while running without a database', async () => {
    expect(recordAudit({ action: 'auth.password.changed', actorId: 'admin-1' })).toBe(true);

    await vi.waitFor(() => expect(getCapturedAudits()).toHaveLength(1));
    expect(getCapturedAudits()[0]?.action).toBe('auth.password.changed');
  });
});
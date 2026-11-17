import { describe, expect, it } from 'vitest';
import { adminAuditContext, toAuditInput } from '@/lib/audit/auditContext';
import type { AdminAuditContext } from '@/lib/audit/auditContext';

const actor = {
  id: 'admin-1',
  email: 'admin@megatech.org',
  firstName: 'Ada',
  lastName: 'Lovelace',
  isSuperAdmin: false,
};

const makeReq = (overrides: Record<string, unknown> = {}) =>
  ({
    admin: actor,
    ip: '203.0.113.7',
    get: (header: string) => (header === 'user-agent' ? 'TestAgent/1.0' : undefined),
    ...overrides,
  }) as never;

describe('adminAuditContext', () => {
  it('extracts actor, ip and user agent from the request', () => {
    expect(adminAuditContext(makeReq())).toEqual({
      actor,
      ip: '203.0.113.7',
      userAgent: 'TestAgent/1.0',
    });
  });

  it('truncates the user agent to 512 characters', () => {
    const ctx = adminAuditContext(makeReq({ get: () => 'a'.repeat(600) }));

    expect(ctx.userAgent).toHaveLength(512);
  });

  it('falls back to null when ip and user agent are missing', () => {
    const ctx = adminAuditContext(makeReq({ ip: undefined, get: () => undefined }));

    expect(ctx.ip).toBeNull();
    expect(ctx.userAgent).toBeNull();
  });
});

describe('toAuditInput', () => {
  it('shapes one audit row with the actor email in meta', () => {
    const ctx: AdminAuditContext = { actor, ip: '203.0.113.7', userAgent: 'TestAgent/1.0' };

    expect(toAuditInput(ctx, 'media.created', 'media:m1', { title: 'Sermon' })).toEqual({
      action: 'media.created',
      actorId: 'admin-1',
      actorType: 'ADMIN',
      resource: 'media:m1',
      ip: '203.0.113.7',
      userAgent: 'TestAgent/1.0',
      meta: { title: 'Sermon', actorEmail: 'admin@megatech.org' },
    });
  });
});

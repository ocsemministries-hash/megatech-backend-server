import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSubscriberUsecases } from '@/modules/admin/admin.subscriber.usecases';
import { SubscriberNotFoundError, CampaignNotFoundError } from '@/modules/newsletter/newsletter.errors';
import { clearCapturedAudits } from '@/modules/audit/audit.events';
import type { AdminAuditContext } from '@/lib/audit/auditContext';

const ctx: AdminAuditContext = {
  actor: { id: 'admin-1', email: 'admin@megatech.org', firstName: 'Ada', lastName: 'Okonkwo', isSuperAdmin: false },
  ip: '203.0.113.7',
  userAgent: 'TestAgent/1.0',
};

const fakeTx = { run: (work: (db: never) => Promise<never>) => work({} as never) };

const subscriberRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  email: 'grace@example.com',
  name: 'Grace',
  source: 'PUBLIC',
  userId: null,
  status: 'ACTIVE',
  unsubscribeToken: 'tok-1',
  subscribedAt: new Date('2026-10-18T10:00:00.000Z'),
  unsubscribedAt: null,
  createdAt: new Date('2026-10-18T10:00:00.000Z'),
  updatedAt: new Date('2026-10-18T10:00:00.000Z'),
  ...overrides,
});

const campaignRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'cmp-1',
  subject: 'Hello',
  body: 'Body',
  status: 'SENDING',
  audience: 'ACTIVE',
  recipientCount: 2,
  sentCount: 0,
  failedCount: 0,
  createdByName: 'Ada Okonkwo',
  sentAt: null,
  createdAt: new Date('2026-10-18T10:00:00.000Z'),
  updatedAt: new Date('2026-10-18T10:00:00.000Z'),
  ...overrides,
});

const fakes = () => ({
  repo: {
    findById: vi.fn(),
    setStatus: vi.fn(),
    remove: vi.fn(),
    listAdmin: vi.fn(),
    countByStatus: vi.fn(),
    listActive: vi.fn(),
    createCampaign: vi.fn(),
    findCampaignById: vi.fn(),
    listCampaigns: vi.fn(),
  },
  auditLogs: { record: vi.fn(async () => ({ id: 'log-1' })) },
});

beforeEach(() => clearCapturedAudits());

describe('admin subscribers: status', () => {
  it('throws 404 for an unknown subscriber', async () => {
    const { repo, auditLogs } = fakes();
    repo.findById.mockResolvedValue(null);

    await expect(
      new AdminSubscriberUsecases(repo as never, auditLogs as never, fakeTx as never).setStatus(
        ctx,
        'sub-404',
        'UNSUBSCRIBED'
      )
    ).rejects.toBeInstanceOf(SubscriberNotFoundError);
    expect(repo.setStatus).not.toHaveBeenCalled();
  });

  it('advances status and writes an audit row', async () => {
    const { repo, auditLogs } = fakes();
    repo.findById
      .mockResolvedValueOnce(subscriberRow())
      .mockResolvedValueOnce(subscriberRow({ status: 'UNSUBSCRIBED', unsubscribedAt: new Date() }));
    repo.setStatus.mockResolvedValue(subscriberRow({ status: 'UNSUBSCRIBED' }));

    const result = await new AdminSubscriberUsecases(repo as never, auditLogs as never, fakeTx as never).setStatus(
      ctx,
      'sub-1',
      'UNSUBSCRIBED'
    );

    expect(repo.setStatus).toHaveBeenCalledWith('sub-1', 'UNSUBSCRIBED', {});
    expect(auditLogs.record).toHaveBeenCalledTimes(1);
    expect(result?.status).toBe('UNSUBSCRIBED');
  });

  it('is a no-op (no audit) when the status is unchanged', async () => {
    const { repo, auditLogs } = fakes();
    repo.findById.mockResolvedValue(subscriberRow({ status: 'ACTIVE' }));

    await new AdminSubscriberUsecases(repo as never, auditLogs as never, fakeTx as never).setStatus(
      ctx,
      'sub-1',
      'ACTIVE'
    );

    expect(repo.setStatus).not.toHaveBeenCalled();
    expect(auditLogs.record).not.toHaveBeenCalled();
  });
});

describe('admin subscribers: remove', () => {
  it('throws 404 for an unknown subscriber', async () => {
    const { repo, auditLogs } = fakes();
    repo.findById.mockResolvedValue(null);

    await expect(
      new AdminSubscriberUsecases(repo as never, auditLogs as never, fakeTx as never).remove(ctx, 'sub-404')
    ).rejects.toBeInstanceOf(SubscriberNotFoundError);
  });

  it('deletes the row and audits it', async () => {
    const { repo, auditLogs } = fakes();
    repo.findById.mockResolvedValue(subscriberRow());
    repo.remove.mockResolvedValue(subscriberRow());

    await new AdminSubscriberUsecases(repo as never, auditLogs as never, fakeTx as never).remove(ctx, 'sub-1');

    expect(repo.remove).toHaveBeenCalledWith('sub-1', {});
    expect(auditLogs.record).toHaveBeenCalledTimes(1);
  });
});

describe('admin subscribers: broadcast', () => {
  it('records a SENDING campaign with the active recipient count', async () => {
    const { repo, auditLogs } = fakes();
    repo.listActive.mockResolvedValue([subscriberRow({ id: 'sub-1' }), subscriberRow({ id: 'sub-2' })]);
    repo.createCampaign.mockResolvedValue(campaignRow());

    const campaign = await new AdminSubscriberUsecases(repo as never, auditLogs as never, fakeTx as never).broadcast(
      ctx,
      { subject: 'Hello', body: 'Body' }
    );

    expect(repo.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Hello', status: 'SENDING', recipientCount: 2, audience: 'ACTIVE' }),
      {}
    );
    expect(auditLogs.record).toHaveBeenCalledTimes(1);
    expect(campaign.id).toBe('cmp-1');
  });
});

describe('admin subscribers: campaigns', () => {
  it('throws 404 for an unknown campaign', async () => {
    const { repo, auditLogs } = fakes();
    repo.findCampaignById.mockResolvedValue(null);

    await expect(
      new AdminSubscriberUsecases(repo as never, auditLogs as never, fakeTx as never).getCampaign('cmp-404')
    ).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterUsecases } from '@/modules/newsletter/newsletter.usecases';

const row = (overrides: Record<string, unknown> = {}) => ({
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

const fakes = () => ({
  findByEmail: vi.fn(),
  findByUnsubscribeToken: vi.fn(),
  createSubscriber: vi.fn(),
  reactivate: vi.fn(),
  unsubscribe: vi.fn(),
});

describe('newsletter subscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a PUBLIC subscriber for anonymous visitors and lowercases the email', async () => {
    const repo = fakes();
    repo.findByEmail.mockResolvedValue(null);
    repo.createSubscriber.mockResolvedValue(row());

    const result = await new NewsletterUsecases(repo as never).subscribe(
      { email: '  Grace@Example.com ' },
      null
    );

    expect(repo.findByEmail).toHaveBeenCalledWith('grace@example.com');
    expect(repo.createSubscriber).toHaveBeenCalledWith({
      email: 'grace@example.com',
      name: null,
      source: 'PUBLIC',
      userId: null,
    });
    expect(result.id).toBe('sub-1');
  });

  it('records source USER + id for signed-in partners', async () => {
    const repo = fakes();
    repo.findByEmail.mockResolvedValue(null);
    repo.createSubscriber.mockResolvedValue(row({ source: 'USER', userId: 'user-9' }));

    await new NewsletterUsecases(repo as never).subscribe(
      { email: 'grace@example.com' },
      { id: 'user-9', email: 'grace@example.com' }
    );

    expect(repo.createSubscriber).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'USER', userId: 'user-9' })
    );
  });

  it('returns the existing row untouched when already active', async () => {
    const repo = fakes();
    const existing = row();
    repo.findByEmail.mockResolvedValue(existing);

    const result = await new NewsletterUsecases(repo as never).subscribe(
      { email: 'grace@example.com' },
      null
    );

    expect(repo.reactivate).not.toHaveBeenCalled();
    expect(repo.createSubscriber).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it('reactivates a previously unsubscribed contact', async () => {
    const repo = fakes();
    repo.findByEmail.mockResolvedValue(row({ status: 'UNSUBSCRIBED' }));
    repo.reactivate.mockResolvedValue(row({ status: 'ACTIVE' }));

    await new NewsletterUsecases(repo as never).subscribe({ email: 'grace@example.com' }, null);

    expect(repo.reactivate).toHaveBeenCalledWith('sub-1', { name: 'Grace', userId: null });
  });
});

describe('newsletter unsubscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false for an unknown token', async () => {
    const repo = fakes();
    repo.findByUnsubscribeToken.mockResolvedValue(null);

    await expect(new NewsletterUsecases(repo as never).unsubscribe('nope')).resolves.toBe(false);
    expect(repo.unsubscribe).not.toHaveBeenCalled();
  });

  it('opts out a known subscriber', async () => {
    const repo = fakes();
    repo.findByUnsubscribeToken.mockResolvedValue(row());

    await expect(new NewsletterUsecases(repo as never).unsubscribe('tok-1')).resolves.toBe(true);
    expect(repo.unsubscribe).toHaveBeenCalledWith('tok-1');
  });
});

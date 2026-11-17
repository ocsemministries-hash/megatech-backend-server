import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => {
  const makeMethods = () => ({
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  });
  return {
    admin: makeMethods(),
    role: makeMethods(),
    permission: makeMethods(),
    rolePermission: makeMethods(),
    verificationToken: makeMethods(),
    auditLog: makeMethods(),
  };
});

vi.mock('@/lib/dal/base/prisma.client', () => ({ prisma }));

import { AdminRepository } from '@/lib/dal/repositories/admin/admin.repository';
import { VerificationTokenRepository } from '@/lib/dal/repositories/verificationToken/verificationToken.repository';

describe('AdminRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lowercases email on create', async () => {
    prisma.admin.create.mockResolvedValue({ id: 'a1' });
    const repo = new AdminRepository();

    await repo.createAdmin({
      firstName: 'Ada',
      lastName: 'L',
      email: 'ADA@MEGATECH.ORG',
      passwordHash: 'h',
    });

    expect(prisma.admin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'ada@megatech.org' }),
    });
  });

  it('looks admins up by lowercased email', async () => {
    prisma.admin.findUnique.mockResolvedValue(null);
    const repo = new AdminRepository();

    await repo.findByEmail('ROOT@MEGATECH.ORG');

    expect(prisma.admin.findUnique).toHaveBeenCalledWith({ where: { email: 'root@megatech.org' } });
  });
});

describe('VerificationTokenRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deactivates active tokens of a type/identifier', async () => {
    prisma.verificationToken.updateMany.mockResolvedValue({ count: 2 });
    const repo = new VerificationTokenRepository();
    const now = new Date('2026-01-01T00:00:00.000Z');

    const count = await repo.deactivateActive('OTP', 'a@b.com', now);

    expect(prisma.verificationToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenType: 'OTP',
        identifier: 'a@b.com',
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    expect(count).toBe(2);
  });

  it('purges expired and old consumed tokens', async () => {
    prisma.verificationToken.deleteMany.mockResolvedValue({ count: 5 });
    const repo = new VerificationTokenRepository();
    const now = new Date('2026-01-01T00:00:00.000Z');

    const count = await repo.purge(now, 86_400_000);

    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { consumedAt: { lt: new Date('2025-12-31T00:00:00.000Z') } },
        ],
      },
    });
    expect(count).toBe(5);
  });
});

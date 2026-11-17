import type { Prisma, VerificationToken } from '@prisma/client';
import { prisma } from '../../base/prisma.client';
import { BaseRepository } from '../../base/base.repository';
import type { ModelDelegate } from '../../base/base.repository.types';
import type { CreateVerificationTokenInput } from './verificationToken.schema';

export class VerificationTokenRepository extends BaseRepository<
  VerificationToken,
  CreateVerificationTokenInput,
  { consumedAt?: Date | null; failedAttempts?: number }
> {
  constructor() {
    super(prisma.verificationToken as unknown as ModelDelegate<VerificationToken>);
  }

  async createToken(data: CreateVerificationTokenInput): Promise<VerificationToken> {
    return this.create(data);
  }

  /** Latest unconsumed, unexpired token of a given type for an identifier. */
  async findActive(tokenType: VerificationToken['tokenType'], identifier: string): Promise<VerificationToken | null> {
    return prisma.verificationToken.findFirst({
      where: { tokenType, identifier, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByHash(tokenHash: string): Promise<VerificationToken | null> {
    return this.findFirst({ tokenHash });
  }

  /** Consumes every currently-active token of a type/identifier (single-active policy). */
  async deactivateActive(tokenType: VerificationToken['tokenType'], identifier: string, now: Date = new Date()): Promise<number> {
    const result = await prisma.verificationToken.updateMany({
      where: { tokenType, identifier, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    return result.count;
  }

  /**
   * Consumes every active refresh token of an admin except the one whose hash
   * is `keepTokenHash` (the caller's own session). Returns how many were revoked.
   */
  async revokeOtherRefreshTokens(adminId: string, keepTokenHash: string | null, now: Date = new Date()): Promise<number> {
    const result = await prisma.verificationToken.updateMany({
      where: {
        tokenType: 'REFRESH',
        adminId,
        consumedAt: null,
        expiresAt: { gt: now },
        ...(keepTokenHash ? { NOT: { tokenHash: keepTokenHash } } : {}),
      },
      data: { consumedAt: now },
    });
    return result.count;
  }

  async markConsumed(id: string): Promise<void> {
    await prisma.verificationToken.update({ where: { id }, data: { consumedAt: new Date() } });
  }

  async incrementFailedAttempts(id: string): Promise<void> {
    await prisma.verificationToken.update({
      where: { id },
      data: { failedAttempts: { increment: 1 } },
    });
  }

  /** Removes expired tokens and consumed tokens older than `retentionMs`. */
  async purge(now: Date = new Date(), retentionMs = 24 * 60 * 60 * 1000): Promise<number> {
    const result = await prisma.verificationToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { consumedAt: { lt: new Date(now.getTime() - retentionMs) } },
        ],
      } satisfies Prisma.VerificationTokenWhereInput,
    });
    return result.count;
  }
}

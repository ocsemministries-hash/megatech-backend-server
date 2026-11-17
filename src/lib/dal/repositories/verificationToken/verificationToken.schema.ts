import type { TokenChannel, TokenType } from '@prisma/client';

export interface CreateVerificationTokenInput {
  tokenType: TokenType;
  channel?: TokenChannel;
  adminId?: string | null;
  userId?: string | null;
  identifier?: string | null;
  tokenHash: string;
  payload?: PrismaJsonValue | null;
  expiresAt: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaJsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

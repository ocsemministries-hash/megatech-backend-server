import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma.client';

/** Any client a repository write can join: the global client or an interactive transaction. */
export type DbClient = Prisma.TransactionClient | PrismaClient;

/** Runs a unit of work in one interactive Prisma transaction. Injected into usecases so tests can fake it. */
export class TransactionRunner {
  async run<T>(work: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(work);
  }
}

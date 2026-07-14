import { PrismaClient } from '@prisma/client';

/**
 * @fitvo/database — client Prisma singleton.
 * Reaproveita a instancia em dev (evita esgotar conexoes com hot-reload).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';

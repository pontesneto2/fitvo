import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import type { SpecialtyRecord, SpecialtyRepository } from './specialty-repository';

const SPECIALTY_PROJECTION = { id: true, code: true, name: true } as const;

/** Implementacao Prisma (infra) do repositorio de especialidades (D-047). */
export class PrismaSpecialtyRepository implements SpecialtyRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  list(): Promise<SpecialtyRecord[]> {
    return this.db.specialty.findMany({
      select: SPECIALTY_PROJECTION,
      orderBy: { code: 'asc' },
    });
  }

  async exists(specialtyId: string): Promise<boolean> {
    const specialty = await this.db.specialty.findUnique({
      where: { id: specialtyId },
      select: { id: true },
    });
    return specialty !== null;
  }
}

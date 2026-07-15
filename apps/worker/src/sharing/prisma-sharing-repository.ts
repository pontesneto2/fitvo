import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import type {
  CreateSharingSuggestionInput,
  SharingRepository,
  SharingSuggestionRecord,
} from './sharing-repository';

const SUGGESTION_PROJECTION = {
  id: true,
  patientProfileId: true,
  professionalAId: true,
  professionalBId: true,
  specialtyId: true,
  status: true,
} as const;

/** Implementacao Prisma (infra) do repositorio do motor de compartilhamento. */
export class PrismaSharingRepository implements SharingRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async listActiveBondProfessionals(patientProfileId: string): Promise<string[]> {
    const bonds = await this.db.bond.findMany({
      where: { patientProfileId, status: 'ACTIVE' },
      select: { professionalProfileId: true },
      distinct: ['professionalProfileId'],
    });
    return bonds.map((bond) => bond.professionalProfileId);
  }

  async hasPendingSuggestion(
    patientProfileId: string,
    professionalAId: string,
    professionalBId: string,
    specialtyId: string,
  ): Promise<boolean> {
    const suggestion = await this.db.sharingSuggestion.findFirst({
      where: { patientProfileId, professionalAId, professionalBId, specialtyId, status: 'PENDING' },
      select: { id: true },
    });
    return suggestion !== null;
  }

  createSuggestion(input: CreateSharingSuggestionInput): Promise<SharingSuggestionRecord> {
    return this.db.sharingSuggestion.create({
      data: {
        patientProfileId: input.patientProfileId,
        professionalAId: input.professionalAId,
        professionalBId: input.professionalBId,
        specialtyId: input.specialtyId,
      },
      select: SUGGESTION_PROJECTION,
    });
  }
}

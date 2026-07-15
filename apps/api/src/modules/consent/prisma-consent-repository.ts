import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import type { ConsentRecord, ConsentRepository, CreateConsentInput } from './consent-repository';

const CONSENT_PROJECTION = {
  id: true,
  patientProfileId: true,
  granteeProfessionalProfileId: true,
  specialtyId: true,
  status: true,
  grantedAt: true,
  revokedAt: true,
} as const;

/** Implementacao Prisma (infra) do repositorio de consentimento. */
export class PrismaConsentRepository implements ConsentRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async findPatientProfile(accountId: string): Promise<{ patientProfileId: string } | null> {
    const profile = await this.db.patientProfile.findUnique({
      where: { accountId },
      select: { id: true },
    });
    return profile ? { patientProfileId: profile.id } : null;
  }

  async professionalExists(professionalProfileId: string): Promise<boolean> {
    const row = await this.db.professionalProfile.findUnique({
      where: { id: professionalProfileId },
      select: { id: true },
    });
    return row !== null;
  }

  async hasActiveBondInSpecialty(patientProfileId: string, specialtyId: string): Promise<boolean> {
    const bond = await this.db.bond.findFirst({
      where: { patientProfileId, specialtyId, status: 'ACTIVE' },
      select: { id: true },
    });
    return bond !== null;
  }

  findConsent(
    patientProfileId: string,
    granteeProfessionalProfileId: string,
    specialtyId: string,
  ): Promise<ConsentRecord | null> {
    return this.db.consent.findUnique({
      where: {
        patientProfileId_granteeProfessionalProfileId_specialtyId: {
          patientProfileId,
          granteeProfessionalProfileId,
          specialtyId,
        },
      },
      select: CONSENT_PROJECTION,
    });
  }

  createConsent(input: CreateConsentInput): Promise<ConsentRecord> {
    return this.db.consent.create({
      data: {
        patientProfileId: input.patientProfileId,
        granteeProfessionalProfileId: input.granteeProfessionalProfileId,
        specialtyId: input.specialtyId,
      },
      select: CONSENT_PROJECTION,
    });
  }

  reopenConsent(consentId: string): Promise<ConsentRecord> {
    // Reabre a MESMA linha ao reconceder (default documentado — D-016).
    return this.db.consent.update({
      where: { id: consentId },
      data: { status: 'ACTIVE', grantedAt: new Date(), revokedAt: null },
      select: CONSENT_PROJECTION,
    });
  }

  listConsents(patientProfileId: string): Promise<ConsentRecord[]> {
    return this.db.consent.findMany({
      where: { patientProfileId },
      select: CONSENT_PROJECTION,
      orderBy: { grantedAt: 'desc' },
    });
  }

  async revokeConsent(patientProfileId: string, consentId: string): Promise<boolean> {
    // So revoga um consentimento ATIVO do proprio paciente (escopo = titular).
    const result = await this.db.consent.updateMany({
      where: { id: consentId, patientProfileId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async hasActiveConsent(
    patientProfileId: string,
    granteeProfessionalProfileId: string,
    specialtyId: string,
  ): Promise<boolean> {
    const consent = await this.db.consent.findUnique({
      where: {
        patientProfileId_granteeProfessionalProfileId_specialtyId: {
          patientProfileId,
          granteeProfessionalProfileId,
          specialtyId,
        },
      },
      select: { status: true },
    });
    return consent?.status === 'ACTIVE';
  }
}

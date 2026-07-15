import type { ConsentStatus } from '@fitvo/database';

import type { ConsentRecord, ConsentRepository, CreateConsentInput } from './consent-repository';

interface StoredConsent {
  id: string;
  patientProfileId: string;
  granteeProfessionalProfileId: string;
  specialtyId: string;
  status: ConsentStatus;
  grantedAt: Date;
  revokedAt: Date | null;
}

export interface SeedActiveBondInput {
  patientProfileId: string;
  specialtyId: string;
}

/**
 * Implementacao em memoria para testes e dev local. Espelha a logica da
 * implementacao Prisma sobre Maps (o loop single-thread do Node torna cada
 * operacao efetivamente atomica). Os helpers `seed*` arranjam o mundo — os
 * perfis de paciente/profissional e os vinculos ativos vem de outras slices.
 */
export class InMemoryConsentRepository implements ConsentRepository {
  private readonly consents = new Map<string, StoredConsent>();
  private readonly patientProfilesByAccount = new Map<string, string>();
  private readonly professionals = new Set<string>();
  private readonly activeBonds = new Set<string>();
  private sequence = 0;

  // --- Seed helpers (testes/dev; fora da interface de producao) ---

  /** Semeia um perfil de paciente para uma conta. Retorna o id do perfil. */
  seedPatientProfile(accountId: string): string {
    const patientProfileId = this.nextId('patp');
    this.patientProfilesByAccount.set(accountId, patientProfileId);
    return patientProfileId;
  }

  /** Semeia um perfil profissional (grantee valido). */
  seedProfessional(professionalProfileId: string): void {
    this.professionals.add(professionalProfileId);
  }

  /** Semeia um vinculo ATIVO do paciente numa especialidade. */
  seedActiveBond(input: SeedActiveBondInput): void {
    this.activeBonds.add(this.bondKey(input.patientProfileId, input.specialtyId));
  }

  // --- ConsentRepository ---

  findPatientProfile(accountId: string): Promise<{ patientProfileId: string } | null> {
    const patientProfileId = this.patientProfilesByAccount.get(accountId);
    return Promise.resolve(patientProfileId ? { patientProfileId } : null);
  }

  professionalExists(professionalProfileId: string): Promise<boolean> {
    return Promise.resolve(this.professionals.has(professionalProfileId));
  }

  hasActiveBondInSpecialty(patientProfileId: string, specialtyId: string): Promise<boolean> {
    return Promise.resolve(this.activeBonds.has(this.bondKey(patientProfileId, specialtyId)));
  }

  findConsent(
    patientProfileId: string,
    granteeProfessionalProfileId: string,
    specialtyId: string,
  ): Promise<ConsentRecord | null> {
    for (const consent of this.consents.values()) {
      if (
        consent.patientProfileId === patientProfileId &&
        consent.granteeProfessionalProfileId === granteeProfessionalProfileId &&
        consent.specialtyId === specialtyId
      ) {
        return Promise.resolve(this.toRecord(consent));
      }
    }
    return Promise.resolve(null);
  }

  createConsent(input: CreateConsentInput): Promise<ConsentRecord> {
    const consent: StoredConsent = {
      id: this.nextId('cons'),
      patientProfileId: input.patientProfileId,
      granteeProfessionalProfileId: input.granteeProfessionalProfileId,
      specialtyId: input.specialtyId,
      status: 'ACTIVE',
      grantedAt: new Date(),
      revokedAt: null,
    };
    this.consents.set(consent.id, consent);
    return Promise.resolve(this.toRecord(consent));
  }

  reopenConsent(consentId: string): Promise<ConsentRecord> {
    const consent = this.consents.get(consentId);
    if (!consent) {
      throw new Error(`Consentimento ${consentId} inexistente.`);
    }
    consent.status = 'ACTIVE';
    consent.grantedAt = new Date();
    consent.revokedAt = null;
    return Promise.resolve(this.toRecord(consent));
  }

  listConsents(patientProfileId: string): Promise<ConsentRecord[]> {
    const rows = [...this.consents.values()]
      .filter((consent) => consent.patientProfileId === patientProfileId)
      .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime())
      .map((consent) => this.toRecord(consent));
    return Promise.resolve(rows);
  }

  revokeConsent(patientProfileId: string, consentId: string): Promise<boolean> {
    const consent = this.consents.get(consentId);
    if (!consent || consent.patientProfileId !== patientProfileId || consent.status !== 'ACTIVE') {
      return Promise.resolve(false);
    }
    consent.status = 'REVOKED';
    consent.revokedAt = new Date();
    return Promise.resolve(true);
  }

  hasActiveConsent(
    patientProfileId: string,
    granteeProfessionalProfileId: string,
    specialtyId: string,
  ): Promise<boolean> {
    for (const consent of this.consents.values()) {
      if (
        consent.patientProfileId === patientProfileId &&
        consent.granteeProfessionalProfileId === granteeProfessionalProfileId &&
        consent.specialtyId === specialtyId &&
        consent.status === 'ACTIVE'
      ) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  // --- helpers privados ---

  private toRecord(consent: StoredConsent): ConsentRecord {
    return {
      id: consent.id,
      patientProfileId: consent.patientProfileId,
      granteeProfessionalProfileId: consent.granteeProfessionalProfileId,
      specialtyId: consent.specialtyId,
      status: consent.status,
      grantedAt: consent.grantedAt,
      revokedAt: consent.revokedAt,
    };
  }

  private bondKey(patientProfileId: string, specialtyId: string): string {
    return `${patientProfileId}:${specialtyId}`;
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }
}

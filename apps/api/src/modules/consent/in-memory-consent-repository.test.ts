import { describe, expect, it } from 'vitest';

import { InMemoryConsentRepository } from './in-memory-consent-repository';

const SPECIALTY = 'spec_training';
const GRANTEE = 'pp_grantee';

describe('InMemoryConsentRepository', () => {
  it('resolve o perfil de paciente por conta e o grantee/vinculo semeados', async () => {
    const repo = new InMemoryConsentRepository();
    const patientProfileId = repo.seedPatientProfile('acc_pac');
    repo.seedProfessional(GRANTEE);
    repo.seedActiveBond({ patientProfileId, specialtyId: SPECIALTY });

    expect(await repo.findPatientProfile('acc_pac')).toEqual({ patientProfileId });
    expect(await repo.findPatientProfile('acc_estranho')).toBeNull();
    expect(await repo.professionalExists(GRANTEE)).toBe(true);
    expect(await repo.professionalExists('pp_outro')).toBe(false);
    expect(await repo.hasActiveBondInSpecialty(patientProfileId, SPECIALTY)).toBe(true);
    expect(await repo.hasActiveBondInSpecialty(patientProfileId, 'spec_outra')).toBe(false);
  });

  it('cria, detecta e revoga; hasActiveConsent reflete o status', async () => {
    const repo = new InMemoryConsentRepository();
    const patientProfileId = repo.seedPatientProfile('acc_pac');

    const created = await repo.createConsent({
      patientProfileId,
      granteeProfessionalProfileId: GRANTEE,
      specialtyId: SPECIALTY,
    });
    expect(created.status).toBe('ACTIVE');
    expect(await repo.hasActiveConsent(patientProfileId, GRANTEE, SPECIALTY)).toBe(true);

    const found = await repo.findConsent(patientProfileId, GRANTEE, SPECIALTY);
    expect(found?.id).toBe(created.id);

    // Escopo errado nao revoga.
    expect(await repo.revokeConsent('patp_outro', created.id)).toBe(false);
    expect(await repo.revokeConsent(patientProfileId, created.id)).toBe(true);
    // Revogar de novo e no-op.
    expect(await repo.revokeConsent(patientProfileId, created.id)).toBe(false);
    expect(await repo.hasActiveConsent(patientProfileId, GRANTEE, SPECIALTY)).toBe(false);
  });

  it('reabre a MESMA linha ao reconceder (reuso, sem nova linha)', async () => {
    const repo = new InMemoryConsentRepository();
    const patientProfileId = repo.seedPatientProfile('acc_pac');

    const created = await repo.createConsent({
      patientProfileId,
      granteeProfessionalProfileId: GRANTEE,
      specialtyId: SPECIALTY,
    });
    await repo.revokeConsent(patientProfileId, created.id);

    const reopened = await repo.reopenConsent(created.id);
    expect(reopened.id).toBe(created.id);
    expect(reopened.status).toBe('ACTIVE');
    expect(reopened.revokedAt).toBeNull();
    expect(await repo.listConsents(patientProfileId)).toHaveLength(1);
  });
});

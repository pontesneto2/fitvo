import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@fitvo/database';
import { afterAll, describe, expect, it } from 'vitest';

import { hashInviteToken } from '../../shared/invite-token';
import type { RequestOrigin } from '../terms/terms-repository';
import { PrismaClinicRepository } from './prisma-clinic-repository';

/**
 * Integracao — o repositorio PRISMA de clinica contra Postgres real (ADR-0015).
 *
 * O gemeo `in-memory-clinic-repository.test.ts` prova a LOGICA; este prova o
 * MAPEAMENTO e a ATOMICIDADE. O caso de rollback e o coracao: uma falha REAL
 * numa etapa da $transaction (violacao de NOT NULL na gravacao dos termos) tem
 * de reverter TUDO — nem Account, nem ProfessionalProfile, nem ProfessionalSpecialty,
 * nem TermsAcceptanceEvent podem sobreviver, e o convite volta a PENDING. Mesmo
 * rigor do acceptInvite do paciente.
 */

const prisma = new PrismaClient();
const repo = new PrismaClinicRepository(prisma);
const ORIGIN = { ipAddress: '127.0.0.1', userAgent: 'vitest-integration' };
const NEW_ACCOUNT = {
  passwordHash: 'x',
  name: 'Profissional',
  document: '0',
  documentType: 'CPF' as const,
};

afterAll(async () => {
  await prisma.$disconnect();
});

async function seedClinic() {
  const id = randomUUID().slice(0, 8);
  const tenant = await prisma.tenant.create({ data: { type: 'CLINIC', name: `Clinica-${id}` } });
  return { id, tenantId: tenant.id };
}

describe('PrismaClinicRepository — mapeamento e atomicidade contra Postgres real', () => {
  it('createInvite resolve SpecialtyCode->id e persiste conselho + medicalSpecialty (lido do BANCO)', async () => {
    const s = await seedClinic();
    const tokenHash = hashInviteToken(`raw-${s.id}`);

    const invite = await repo.createInvite({
      tenantId: s.tenantId,
      email: `med-${s.id}@int.dev`,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      specialtyCode: 'MEDICINE',
      councilDocument: 'CRM-12345',
      councilState: 'SP',
      medicalSpecialty: 'NUTROLOGIA',
    });

    const medicine = await prisma.specialty.findFirstOrThrow({ where: { code: 'MEDICINE' } });
    const row = await prisma.professionalInvite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(row.specialtyId).toBe(medicine.id);
    expect(row.councilDocument).toBe('CRM-12345');
    expect(row.councilState).toBe('SP');
    expect(row.medicalSpecialty).toBe('NUTROLOGIA');
  });

  it('aceite conta NOVA: cria Account+Profile+ProfessionalSpecialty(com medicalSpecialty)+Terms x2 na mesma tx', async () => {
    const s = await seedClinic();
    const tokenHash = hashInviteToken(`raw-ok-${s.id}`);
    const email = `med-ok-${s.id}@int.dev`;

    await repo.createInvite({
      tenantId: s.tenantId,
      email,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      specialtyCode: 'MEDICINE',
      councilDocument: 'CRM-98765',
      councilState: 'RJ',
      medicalSpecialty: 'ENDOCRINOLOGIA',
    });

    const outcome = await repo.acceptInvite(tokenHash, NEW_ACCOUNT, ORIGIN);
    expect(outcome.status).toBe('accepted');
    if (outcome.status !== 'accepted') return;
    expect(outcome.created).toBe(true);

    // Tudo lido de volta do BANCO (a propagacao e o que esta sob teste).
    const account = await prisma.account.findUniqueOrThrow({
      where: { email },
      select: {
        id: true,
        professionalProfile: {
          select: {
            tenantId: true,
            specialties: {
              select: {
                councilDocument: true,
                councilState: true,
                medicalSpecialty: true,
                verificationStatus: true,
                specialty: { select: { code: true } },
              },
            },
          },
        },
      },
    });
    expect(account.professionalProfile?.tenantId).toBe(s.tenantId);
    const specialties = account.professionalProfile?.specialties ?? [];
    expect(specialties).toHaveLength(1);
    expect(specialties[0]).toMatchObject({
      councilDocument: 'CRM-98765',
      councilState: 'RJ',
      medicalSpecialty: 'ENDOCRINOLOGIA',
      verificationStatus: 'PENDING',
      specialty: { code: 'MEDICINE' },
    });

    // Um evento ACCEPTED por documento obrigatorio (D-025): x2.
    const events = await prisma.termsAcceptanceEvent.count({ where: { accountId: account.id } });
    expect(events).toBe(2);
  });

  it('aceite conta EXISTENTE: cria so o perfil+especialidade que faltavam, sem REGRAVAR termos', async () => {
    const s = await seedClinic();
    const email = `existente-${s.id}@int.dev`;
    // Conta que ja existe (multi-papel — D-041), SEM perfil profissional e SEM
    // nenhum evento de termos (nao passou por cadastro aqui).
    const existing = await prisma.account.create({
      data: { email, passwordHash: 'x', name: 'Ja Existe', document: '1', documentType: 'CPF' },
      select: { id: true },
    });

    const tokenHash = hashInviteToken(`raw-ex-${s.id}`);
    await repo.createInvite({
      tenantId: s.tenantId,
      email,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      specialtyCode: 'NUTRITION',
      councilDocument: 'CRN-55555',
      councilState: 'MG',
    });

    const outcome = await repo.acceptInvite(tokenHash, NEW_ACCOUNT, ORIGIN);
    expect(outcome.status).toBe('accepted');
    if (outcome.status !== 'accepted') return;
    expect(outcome.created).toBe(false);

    const profile = await prisma.professionalProfile.findUniqueOrThrow({
      where: { accountId: existing.id },
      select: { specialties: { select: { specialty: { select: { code: true } } } } },
    });
    expect(profile.specialties).toHaveLength(1);
    expect(profile.specialties[0]?.specialty.code).toBe('NUTRITION');
    // NAO regravou termos (conta existente ja consentiu no proprio cadastro).
    const events = await prisma.termsAcceptanceEvent.count({ where: { accountId: existing.id } });
    expect(events).toBe(0);
  });

  it('ROLLBACK REAL: falha na gravacao dos termos reverte Account+Profile+Specialty+Terms; convite volta a PENDING', async () => {
    const s = await seedClinic();
    const tokenHash = hashInviteToken(`raw-rb-${s.id}`);
    const email = `rollback-${s.id}@int.dev`;

    const invite = await repo.createInvite({
      tenantId: s.tenantId,
      email,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      specialtyCode: 'MEDICINE',
      councilDocument: 'CRM-00000',
      councilState: 'SP',
      medicalSpecialty: 'NUTROLOGIA',
    });

    // Origem INVALIDA: ipAddress null viola o NOT NULL de `terms_acceptance_event`.
    // recordInitialTermsAcceptance e a ULTIMA etapa da tx (conta nova) — ela roda
    // DEPOIS de Account+Profile+ProfessionalSpecialty ja terem sido inseridos na
    // mesma transacao. A falha e REAL (constraint do banco), nao um mock: o
    // Postgres aborta a transacao inteira.
    const badOrigin = { ipAddress: null, userAgent: 'x' } as unknown as RequestOrigin;
    await expect(repo.acceptInvite(tokenHash, NEW_ACCOUNT, badOrigin)).rejects.toBeTruthy();

    // Nada sobreviveu: sem conta (e, por tabela-abaixo, sem perfil/especialidade/eventos).
    expect(await prisma.account.findUnique({ where: { email } })).toBeNull();
    // E prova direta de que nenhuma ProfessionalSpecialty desta clinica nasceu.
    const orphanSpecialties = await prisma.professionalSpecialty.count({
      where: { professionalProfile: { tenantId: s.tenantId } },
    });
    expect(orphanSpecialties).toBe(0);
    const orphanProfiles = await prisma.professionalProfile.count({
      where: { tenantId: s.tenantId },
    });
    expect(orphanProfiles).toBe(0);
    // O convite NAO foi consumido: o claim PENDING->ACCEPTED tambem reverteu.
    const after = await prisma.professionalInvite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(after.status).toBe('PENDING');
  });
});

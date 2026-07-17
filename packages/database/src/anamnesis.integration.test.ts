import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { type Prisma, PrismaClient } from './index';

/**
 * Integracao — MAPEAMENTO da anamnese tipada (ADR-0011) contra Postgres real.
 *
 * POR QUE ESTE ARQUIVO EXISTE: os testes do slice de paciente usam repositorio
 * IN-MEMORY. Eles provam a logica do application service e NAO o mapeamento —
 * campo errado, relacao trocada ou `onDelete` frouxo passam no in-memory e
 * quebram em producao. As 13 tabelas da anamnese sao exatamente onde o
 * mapeamento importa, e ate aqui NADA na suite as tocava.
 *
 * O QUE ESTES TESTES REPROVAM: mapeamento. NAO reprovam o guard de autoria
 * (D-102) — porque nao existe guard: o slice de escrita da anamnese ainda nao
 * foi construido, e o schema ACEITA par de autoria invalido. Um teste que
 * gravasse autoria falsa e afirmasse "o Prisma aceitou" nao provaria guard
 * nenhum: certificaria o defeito. A rejeicao entra no PR do slice de escrita.
 */

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

/** Seed isolado por teste: o banco e compartilhado e nao e limpo entre execucoes. */
async function seedBond() {
  const id = randomUUID().slice(0, 8);
  const tenant = await prisma.tenant.create({ data: { type: 'SOLO', name: `T-${id}` } });
  const specialty = await prisma.specialty.findFirstOrThrow({ where: { code: 'TRAINING' } });

  const pro = await prisma.account.create({
    data: {
      email: `pro-${id}@e2e.dev`,
      passwordHash: 'x',
      name: 'Pro',
      document: '00000000000',
      documentType: 'CPF',
      professionalProfile: { create: { tenantId: tenant.id } },
    },
    select: { id: true, professionalProfile: { select: { id: true } } },
  });
  const patient = await prisma.account.create({
    data: {
      email: `pac-${id}@e2e.dev`,
      passwordHash: 'x',
      name: 'Paciente',
      document: '11111111111',
      documentType: 'CPF',
      patientProfile: { create: {} },
    },
    select: { id: true, patientProfile: { select: { id: true } } },
  });

  const bond = await prisma.bond.create({
    data: {
      tenantId: tenant.id,
      patientProfileId: patient.patientProfile!.id,
      professionalProfileId: pro.professionalProfile!.id,
      specialtyId: specialty.id,
      modality: 'HIBRIDO',
    },
  });

  return { id, tenant, specialty, proAccountId: pro.id, patientAccountId: patient.id, bond };
}

const PARQ_ANSWERS = {
  heartCondition: false,
  chestPainDuringActivity: false,
  chestPainAtRest: false,
  dizzinessOrFainting: false,
  boneOrJointProblem: true,
  bloodPressureOrHeartMedication: false,
  otherReason: false,
} satisfies Partial<Prisma.AnamnesisParqCreateInput>;

describe('anamnese tipada — mapeamento contra Postgres real (ADR-0011)', () => {
  it('D-102: autoria HIBRIDA por secao — paciente declara, profissional afere, na MESMA anamnese', async () => {
    const s = await seedBond();
    const anamnesis = await prisma.anamnesis.create({
      data: { tenantId: s.tenant.id, bondId: s.bond.id },
    });

    await prisma.anamnesisGoal.create({
      data: {
        anamnesisId: anamnesis.id,
        goal: 'Emagrecer',
        authoredBy: 'PATIENT',
        authoredByAccountId: s.patientAccountId,
        authoredAt: new Date(),
      },
    });
    await prisma.anamnesisParq.create({
      data: {
        anamnesisId: anamnesis.id,
        ...PARQ_ANSWERS,
        authoredBy: 'PROFESSIONAL',
        authoredByAccountId: s.proAccountId,
        authoredAt: new Date(),
      },
    });

    const loaded = await prisma.anamnesis.findUniqueOrThrow({
      where: { id: anamnesis.id },
      include: {
        goal: { include: { authoredByAccount: { select: { email: true } } } },
        parq: { include: { authoredByAccount: { select: { email: true } } } },
      },
    });

    expect(loaded.goal?.authoredBy).toBe('PATIENT');
    expect(loaded.parq?.authoredBy).toBe('PROFESSIONAL');

    // A `Account` tem 7 relacoes de autoria, para 7 modelos distintos. Isto prova
    // que cada uma resolve para a conta CERTA — o risco real de relacao trocada.
    expect(loaded.goal?.authoredByAccount.email).toBe(`pac-${s.id}@e2e.dev`);
    expect(loaded.parq?.authoredByAccount.email).toBe(`pro-${s.id}@e2e.dev`);
  });

  it('D-103: secao ausente = LINHA ausente (com a relacao no include — senao passa por vacuidade)', async () => {
    const s = await seedBond();
    const anamnesis = await prisma.anamnesis.create({
      data: { tenantId: s.tenant.id, bondId: s.bond.id },
    });
    await prisma.anamnesisParq.create({
      data: {
        anamnesisId: anamnesis.id,
        ...PARQ_ANSWERS,
        authoredBy: 'PROFESSIONAL',
        authoredByAccountId: s.proAccountId,
        authoredAt: new Date(),
      },
    });

    const loaded = await prisma.anamnesis.findUniqueOrThrow({
      where: { id: anamnesis.id },
      // `lifestyle` PRECISA estar aqui. Sem ela viria `undefined` SEMPRE — a
      // assercao falaria da forma da query, nao do banco, e passaria identica se
      // a linha existisse (docs/troubleshooting.md §6).
      include: { parq: true, lifestyle: true },
    });

    expect(loaded.lifestyle).toBeNull(); // `null` = perguntei e nao existe
    expect(loaded.parq).not.toBeNull(); // ancora: prova que o include funciona
  });

  it('D-102: onDelete Restrict — apagar a conta do autor NAO pode apagar a autoria do documento clinico', async () => {
    const s = await seedBond();
    const anamnesis = await prisma.anamnesis.create({
      data: { tenantId: s.tenant.id, bondId: s.bond.id },
    });
    await prisma.anamnesisParq.create({
      data: {
        anamnesisId: anamnesis.id,
        ...PARQ_ANSWERS,
        authoredBy: 'PROFESSIONAL',
        authoredByAccountId: s.proAccountId,
        authoredAt: new Date(),
      },
    });

    await expect(prisma.account.delete({ where: { id: s.proAccountId } })).rejects.toThrow();

    // A secao sobreviveu com o autor intacto.
    const parq = await prisma.anamnesisParq.findUniqueOrThrow({
      where: { anamnesisId: anamnesis.id },
    });
    expect(parq.authoredByAccountId).toBe(s.proAccountId);
  });

  it('D-094: uma anamnese por vinculo (unique em bondId)', async () => {
    const s = await seedBond();
    await prisma.anamnesis.create({ data: { tenantId: s.tenant.id, bondId: s.bond.id } });

    await expect(
      prisma.anamnesis.create({ data: { tenantId: s.tenant.id, bondId: s.bond.id } }),
    ).rejects.toThrow();
  });

  it('D-093: o gate fecha com a secao preenchida pelo PROFISSIONAL (nao exige acao do paciente)', async () => {
    const s = await seedBond();
    const anamnesis = await prisma.anamnesis.create({
      data: { tenantId: s.tenant.id, bondId: s.bond.id },
    });
    expect(anamnesis.status).toBe('PENDING');

    await prisma.anamnesisParq.create({
      data: {
        anamnesisId: anamnesis.id,
        ...PARQ_ANSWERS,
        authoredBy: 'PROFESSIONAL',
        authoredByAccountId: s.proAccountId,
        authoredAt: new Date(),
      },
    });
    const gated = await prisma.anamnesis.update({
      where: { id: anamnesis.id },
      data: { status: 'ANSWERED', answeredAt: new Date() },
    });

    expect(gated.status).toBe('ANSWERED');
  });
});

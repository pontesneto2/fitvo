import { randomUUID } from 'node:crypto';

import {
  type Prisma,
  prisma as extendedPrisma,
  PrismaClient,
  runWithTenantContext,
} from '@fitvo/database';
import { afterAll, describe, expect, it } from 'vitest';

import { validNewPatientAccount } from '../../testing/patient-account-fixture';
import { PrismaPatientRepository } from './prisma-patient-repository';

/**
 * Integracao — o repositorio PRISMA de paciente/vinculo contra Postgres real.
 *
 * O gemeo deste arquivo, `in-memory-patient-repository.test.ts`, prova a LOGICA;
 * este prova o MAPEAMENTO. A distincao e a razao de existir do arquivo: se o repo
 * Prisma tiver campo errado, relacao trocada ou `onDelete` frouxo, o in-memory
 * passa verde e a producao quebra. `patient-flow.test.ts` (14 testes) roda inteiro
 * sobre o in-memory — nenhum deles toca a coluna `modality`.
 */

const prisma = new PrismaClient();
const repo = new PrismaPatientRepository(prisma);
// `bond` tem RLS (D-152): metodos de LEITURA do repo (ex.: `listActiveBonds`)
// nao expoem uma `tx`/PrismaPromise batchavel (ja fazem `await` e mapeiam o
// resultado por dentro) -- o unico jeito de bater a sessao com a query e
// rodar via o client EXTENDIDO (com a extension) dentro de um contexto ALS.
const repoWithExtension = new PrismaPatientRepository(extendedPrisma);
const ORIGIN = { ipAddress: '127.0.0.1', userAgent: 'vitest-integration' };

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * `prisma` aqui e cru (sem a extension de tenant). `bond` tem RLS (D-152,
 * ADR-0017 Slice 3/3) -- leituras diretas neste client, fora de
 * `repo.acceptInvite` (que ja seta a sessao sozinho via
 * `setRlsTenantSession`), precisam bater a variavel de sessao manualmente na
 * MESMA mini-transacao.
 */
async function withTenantSession<T>(tenantId: string, op: Prisma.PrismaPromise<T>): Promise<T> {
  const [, result] = await prisma.$transaction([
    prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
    op,
  ]);
  return result;
}

async function seedProfessional() {
  const id = randomUUID().slice(0, 8);
  const tenant = await prisma.tenant.create({ data: { type: 'SOLO', name: `T-${id}` } });
  const specialty = await prisma.specialty.findFirstOrThrow({ where: { code: 'TRAINING' } });
  const pro = await prisma.account.create({
    data: {
      email: `pro-${id}@int.dev`,
      passwordHash: 'x',
      name: 'Pro',
      document: '0',
      documentType: 'CPF',
      professionalProfile: { create: { tenantId: tenant.id } },
    },
    select: { id: true, professionalProfile: { select: { id: true } } },
  });
  const professionalProfileId = pro.professionalProfile!.id;
  await prisma.professionalSpecialty.create({
    data: { professionalProfileId, specialtyId: specialty.id },
  });
  return { id, tenantId: tenant.id, specialtyId: specialty.id, professionalProfileId };
}

describe('PrismaPatientRepository — mapeamento contra Postgres real', () => {
  it('D-101: o vinculo NASCE com a modalidade do convite (lida de volta do BANCO)', async () => {
    const s = await seedProfessional();
    const tokenHash = `hash-${s.id}`;

    const invite = await repo.createInvite({
      tenantId: s.tenantId,
      professionalProfileId: s.professionalProfileId,
      specialtyId: s.specialtyId,
      email: `pac-${s.id}@int.dev`,
      modality: 'PRESENCIAL',
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(invite.modality).toBe('PRESENCIAL');

    const outcome = await repo.acceptInvite(
      tokenHash,
      validNewPatientAccount({ name: 'Paciente' }),
      ORIGIN,
    );
    expect(outcome.status).toBe('accepted');
    if (outcome.status !== 'accepted') return;

    // Lido do BANCO, nao do retorno do metodo: a PROPAGACAO e o que esta sob
    // teste, e o retorno poderia estar certo com a coluna errada.
    const bond = await withTenantSession(
      s.tenantId,
      prisma.bond.findUniqueOrThrow({ where: { id: outcome.bondId } }),
    );
    expect(bond.modality).toBe('PRESENCIAL');
  });

  it('D-101: a modalidade nao e um default disfarcado — ONLINE propaga como ONLINE', async () => {
    const s = await seedProfessional();
    const tokenHash = `hash-online-${s.id}`;

    // Ancora: o teste de cima sozinho passaria se `modality` fosse ignorada e o
    // banco tivesse PRESENCIAL como default. Com dois valores distintos, nao passa.
    await repo.createInvite({
      tenantId: s.tenantId,
      professionalProfileId: s.professionalProfileId,
      specialtyId: s.specialtyId,
      email: `pac-online-${s.id}@int.dev`,
      modality: 'ONLINE',
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const outcome = await repo.acceptInvite(
      tokenHash,
      validNewPatientAccount({ name: 'Paciente Online' }),
      ORIGIN,
    );
    expect(outcome.status).toBe('accepted');
    if (outcome.status !== 'accepted') return;

    const bond = await withTenantSession(
      s.tenantId,
      prisma.bond.findUniqueOrThrow({ where: { id: outcome.bondId } }),
    );
    expect(bond.modality).toBe('ONLINE');
  });

  it('a modalidade sobrevive a leitura do overview (projecao do repo)', async () => {
    const s = await seedProfessional();
    const tokenHash = `hash-ov-${s.id}`;
    await repo.createInvite({
      tenantId: s.tenantId,
      professionalProfileId: s.professionalProfileId,
      specialtyId: s.specialtyId,
      email: `pac-ov-${s.id}@int.dev`,
      modality: 'HIBRIDO',
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await repo.acceptInvite(tokenHash, validNewPatientAccount({ name: 'Pac Ov' }), ORIGIN);

    // INVITE_PROJECTION / a projecao de bonds sao `select` explicitos: um campo
    // esquecido ali some silenciosamente da API sem quebrar tipo nenhum.
    // `listActiveBonds` ja resolve a promise internamente (nao da pra batchar
    // um SET LOCAL em volta) -- usa o client extendido + ALS aberto, que bate
    // a sessao automaticamente no caminho avulso (ver tenant-isolation-extension.ts).
    const bonds = await runWithTenantContext(s.tenantId, async () =>
      repoWithExtension.listActiveBonds(s.tenantId, s.professionalProfileId),
    );
    expect(bonds).toHaveLength(1);
    expect(bonds[0]?.modality).toBe('HIBRIDO');
    expect(bonds[0]?.patientEmail).toBe(`pac-ov-${s.id}@int.dev`);
  });
});

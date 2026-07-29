import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@fitvo/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashInviteToken } from '../../shared/invite-token';
import type { CreateCompanyInput } from '../auth/account-repository';
import { PrismaAccountRepository } from '../auth/prisma-account-repository';
import { PrismaReceptionRepository } from './prisma-reception-repository';
import type { NewReceptionAccount } from './reception-repository';

/**
 * Integração — seat de RECEPÇÃO (D-156) contra Postgres real.
 *
 * O double in-memory prova o fluxo; só o banco prova o MAPEAMENTO (as colunas
 * de pessoa realmente chegam), a ATOMICIDADE (conta + seat + termos numa
 * transação) e o ROLLBACK (uma falha no meio não deixa órfão). São afirmações
 * sobre o schema — e afirmação sobre schema se prova contra o schema.
 */

const prisma = new PrismaClient();
const accounts = new PrismaAccountRepository(prisma);
const repo = new PrismaReceptionRepository(prisma);
const ORIGIN = { ipAddress: '127.0.0.1', userAgent: 'vitest-integration' };

let trainingSpecialtyId = '';

beforeAll(async () => {
  trainingSpecialtyId = (await prisma.specialty.findUniqueOrThrow({ where: { code: 'TRAINING' } }))
    .id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function companyInput(email: string): CreateCompanyInput {
  return {
    tenantType: 'CLINIC',
    legalName: `Empresa ${email} LTDA`,
    tradeName: `Empresa ${email}`,
    cnpj: '11222333000181',
    companyEmail: `contato-${email}`,
    companyPhone: '1133334444',
    address: {
      cep: '01310930',
      logradouro: 'Avenida Paulista',
      numero: '2000',
      bairro: 'Bela Vista',
      cidade: 'Sao Paulo',
      state: 'SP',
      country: 'BR',
    },
    admin: {
      email,
      passwordHash: 'hash-nao-importa',
      name: 'Gestor',
      document: '52998224725',
      whatsapp: '11987654321',
      birthDate: new Date('1988-06-10T00:00:00Z'),
    },
    termsAcceptance: ORIGIN,
  };
}

/** Arranja uma empresa REAL pelo caminho de produção (`createCompany`). */
async function seedCompany(): Promise<string> {
  const email = `empresa-${randomUUID().slice(0, 8)}@int.dev`;
  const account = await accounts.createCompany({
    ...companyInput(email),
    professional: {
      specialtyId: trainingSpecialtyId,
      councilDocument: 'CREF-123456',
      councilState: 'SP',
    },
  });
  const profile = await prisma.professionalProfile.findUniqueOrThrow({
    where: { accountId: account.id },
    select: { tenantId: true },
  });
  return profile.tenantId;
}

function receptionAccount(): NewReceptionAccount {
  return {
    passwordHash: 'hash-nao-importa',
    name: 'Recepcionista Real',
    socialName: 'Rê',
    gender: 'MULHER_CIS',
    document: '52998224725',
    documentType: 'CPF',
    whatsapp: '11912345678',
    birthDate: new Date('1995-05-14T00:00:00Z'),
    address: {
      cep: '01310930',
      logradouro: 'Avenida Paulista',
      numero: '1500',
      complemento: 'Sala 5',
      bairro: 'Bela Vista',
      cidade: 'Sao Paulo',
      state: 'SP',
      country: 'BR',
    },
  };
}

async function createInvite(tenantId: string, email: string): Promise<string> {
  const token = randomUUID();
  await repo.createInvite({
    tenantId,
    email,
    tokenHash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + 3600_000),
  });
  return token;
}

describe('PrismaReceptionRepository — seat de recepção contra Postgres real (D-156)', () => {
  it('aceite cria Account + ReceptionProfile + 2 eventos de termos NA MESMA transação', async () => {
    const tenantId = await seedCompany();
    const email = `recepcao-${randomUUID().slice(0, 8)}@int.dev`;
    const token = await createInvite(tenantId, email);

    const outcome = await repo.acceptInvite(hashInviteToken(token), receptionAccount(), ORIGIN);
    expect(outcome).toMatchObject({ status: 'accepted', tenantId, created: true });

    const account = await prisma.account.findUniqueOrThrow({
      where: { email },
      select: {
        id: true,
        name: true,
        socialName: true,
        gender: true,
        document: true,
        documentType: true,
        whatsapp: true,
        birthDate: true,
        addressStreet: true,
        addressNumber: true,
        addressComplement: true,
        addressCity: true,
        addressState: true,
        addressZipCode: true,
        receptionProfile: { select: { tenantId: true } },
        termsAcceptanceEvents: { select: { type: true } },
      },
    });

    // MAPEAMENTO: os campos de pessoa chegam mesmo — é o que o double não vê.
    expect(account).toMatchObject({
      name: 'Recepcionista Real',
      socialName: 'Rê',
      gender: 'MULHER_CIS',
      document: '52998224725',
      documentType: 'CPF',
      whatsapp: '11912345678',
      addressStreet: 'Avenida Paulista',
      addressNumber: '1500',
      addressComplement: 'Sala 5',
      addressCity: 'Sao Paulo',
      addressState: 'SP',
      addressZipCode: '01310930',
    });
    expect(account.birthDate?.toISOString()).toBe('1995-05-14T00:00:00.000Z');
    expect(account.receptionProfile).toMatchObject({ tenantId });
    // D-025: um evento ACCEPTED por documento obrigatório, na mesma transação.
    expect(account.termsAcceptanceEvents).toHaveLength(2);
    expect(account.termsAcceptanceEvents.every((e) => e.type === 'ACCEPTED')).toBe(true);
  });

  it('o seat NÃO cria ClinicMembership — recepção não é admin da empresa', async () => {
    const tenantId = await seedCompany();
    const email = `sem-membership-${randomUUID().slice(0, 8)}@int.dev`;
    const token = await createInvite(tenantId, email);
    await repo.acceptInvite(hashInviteToken(token), receptionAccount(), ORIGIN);

    const account = await prisma.account.findUniqueOrThrow({ where: { email } });
    // A ClinicMembership só carrega CLINIC_ADMIN: dar uma à recepção seria dar
    // poder de admin da empresa a um seat administrativo restrito. O vínculo da
    // recepção com o tenant É a linha de reception_profile, e só ela.
    const memberships = await prisma.clinicMembership.count({
      where: { accountId: account.id },
    });
    expect(memberships).toBe(0);
    // E nenhum perfil que atende nasceu junto.
    expect(await prisma.professionalProfile.count({ where: { accountId: account.id } })).toBe(0);
    expect(await prisma.internProfile.count({ where: { accountId: account.id } })).toBe(0);
  });

  it('conta JÁ existente (multi-papel — D-041): cria só o seat, sem regravar termos', async () => {
    const tenantId = await seedCompany();
    const email = `multi-${randomUUID().slice(0, 8)}@int.dev`;

    // Primeiro aceite: nasce a conta com os 2 eventos de termos.
    const first = await createInvite(tenantId, email);
    await repo.acceptInvite(hashInviteToken(first), receptionAccount(), ORIGIN);
    const account = await prisma.account.findUniqueOrThrow({ where: { email } });
    const eventsBefore = await prisma.termsAcceptanceEvent.count({
      where: { accountId: account.id },
    });
    expect(eventsBefore).toBe(2);

    // Remove o seat para simular "conta existe, mas ainda não é recepção" — o
    // ramo `existing` sem conflito.
    await prisma.receptionProfile.deleteMany({ where: { accountId: account.id } });

    const second = await createInvite(tenantId, email);
    const outcome = await repo.acceptInvite(hashInviteToken(second), receptionAccount(), ORIGIN);
    expect(outcome).toMatchObject({ status: 'accepted', accountId: account.id, created: false });

    // Termos NÃO regravados — quem já aceitou não reaceita (D-025).
    expect(await prisma.termsAcceptanceEvent.count({ where: { accountId: account.id } })).toBe(
      eventsBefore,
    );
    expect(await prisma.receptionProfile.count({ where: { accountId: account.id } })).toBe(1);
  });

  it('recusa segundo seat na mesma conta (1:1 — @unique no accountId)', async () => {
    const tenantId = await seedCompany();
    const email = `dupla-${randomUUID().slice(0, 8)}@int.dev`;

    const first = await createInvite(tenantId, email);
    expect(
      (await repo.acceptInvite(hashInviteToken(first), receptionAccount(), ORIGIN)).status,
    ).toBe('accepted');

    const second = await createInvite(tenantId, email);
    expect(
      (await repo.acceptInvite(hashInviteToken(second), receptionAccount(), ORIGIN)).status,
    ).toBe('conflict');
  });

  it('token de USO ÚNICO: o segundo aceite do mesmo token é inválido', async () => {
    const tenantId = await seedCompany();
    const email = `unico-${randomUUID().slice(0, 8)}@int.dev`;
    const token = await createInvite(tenantId, email);

    expect(
      (await repo.acceptInvite(hashInviteToken(token), receptionAccount(), ORIGIN)).status,
    ).toBe('accepted');
    expect(
      (await repo.acceptInvite(hashInviteToken(token), receptionAccount(), ORIGIN)).status,
    ).toBe('invalid');
  });

  it('convite EXPIRADO não cria nada', async () => {
    const tenantId = await seedCompany();
    const email = `expirado-${randomUUID().slice(0, 8)}@int.dev`;
    const token = randomUUID();
    await repo.createInvite({
      tenantId,
      email,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(
      (await repo.acceptInvite(hashInviteToken(token), receptionAccount(), ORIGIN)).status,
    ).toBe('invalid');
    expect(await prisma.account.count({ where: { email } })).toBe(0);
  });

  it('ROLLBACK REAL: falha no meio da transação não deixa conta, seat nem termos órfãos', async () => {
    const tenantId = await seedCompany();
    const email = `rollback-${randomUUID().slice(0, 8)}@int.dev`;
    const token = await createInvite(tenantId, email);

    // Documento acima do limite da coluna faz o INSERT da Account estourar
    // DEPOIS de o convite já ter sido marcado ACCEPTED dentro da transação. Se
    // a atomicidade falhasse, sobraria convite consumido sem conta — o pior
    // estado possível: o token queimou e a pessoa não entrou.
    const broken: NewReceptionAccount = {
      ...receptionAccount(),
      // `addressState` é enum no banco: um valor fora do enum quebra o INSERT.
      address: { ...receptionAccount().address, state: 'XX' as never },
    };
    await expect(repo.acceptInvite(hashInviteToken(token), broken, ORIGIN)).rejects.toThrow();

    // NADA sobrou.
    expect(await prisma.account.count({ where: { email } })).toBe(0);
    // E o convite continua PENDENTE — o token NÃO foi queimado.
    const invite = await prisma.receptionInvite.findUniqueOrThrow({
      where: { tokenHash: hashInviteToken(token) },
      select: { status: true },
    });
    expect(invite.status).toBe('PENDING');
  });

  it('isolamento de tenant: findPendingInviteByEmail não enxerga convite de outra empresa (D-002)', async () => {
    const tenantA = await seedCompany();
    const tenantB = await seedCompany();
    const email = `isolado-${randomUUID().slice(0, 8)}@int.dev`;
    await createInvite(tenantA, email);

    expect(await repo.findPendingInviteByEmail(tenantA, email)).not.toBeNull();
    // Mesmo e-mail, outra empresa: não existe para ela.
    expect(await repo.findPendingInviteByEmail(tenantB, email)).toBeNull();
  });
});

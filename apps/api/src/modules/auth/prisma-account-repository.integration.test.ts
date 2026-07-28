import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@fitvo/database';
import { afterAll, describe, expect, it } from 'vitest';

import { PrismaAccountRepository } from './prisma-account-repository';

/**
 * Integracao — o repositorio PRISMA de identidade contra Postgres real.
 *
 * Foco deste arquivo: a atomicidade de `createProfessional` (D-137/D-045) —
 * conta+tenant+perfil+ProfessionalSpecialty nascem juntos, na MESMA transacao,
 * ou nada nasce. O gemeo `patient/prisma-patient-repository.integration.test.ts`
 * segue o mesmo padrao para o aceite de convite.
 */

const prisma = new PrismaClient();
const repo = new PrismaAccountRepository(prisma);
const ORIGIN = { ipAddress: '127.0.0.1', userAgent: 'vitest-integration' };

afterAll(async () => {
  await prisma.$disconnect();
});

function input(email: string, specialtyId: string) {
  return {
    email,
    passwordHash: 'hash-nao-importa',
    name: `Integracao ${email}`,
    document: '52998224725',
    documentType: 'CPF' as const,
    whatsapp: '11987654321',
    birthDate: new Date('1990-01-15T00:00:00Z'),
    address: {
      cep: '01310930',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'Sao Paulo',
      state: 'SP' as const,
      country: 'BR',
    },
    specialtyId,
    councilDocument: 'CREF-123456',
    councilState: 'SP' as const,
    termsAcceptance: ORIGIN,
  };
}

describe('PrismaAccountRepository — createProfessional (mapeamento contra Postgres real)', () => {
  it('D-137: cria a ProfessionalSpecialty (PENDING) na MESMA transacao da conta', async () => {
    const email = `pro-${randomUUID().slice(0, 8)}@int.dev`;
    const account = await repo.createProfessional(input(email, 'spec_training'));

    // Lido do BANCO, nao do retorno do metodo: a propagacao e o que esta sob teste.
    const profile = await prisma.professionalProfile.findUniqueOrThrow({
      where: { accountId: account.id },
      select: {
        id: true,
        specialties: { select: { specialtyId: true, verificationStatus: true } },
      },
    });
    expect(profile.specialties).toHaveLength(1);
    expect(profile.specialties[0]).toMatchObject({
      specialtyId: 'spec_training',
      verificationStatus: 'PENDING',
    });
  });

  it('ADR-0015: grava whatsapp/nascimento/endereco na Account e deriva o nome do Tenant SOLO', async () => {
    const email = `campos-${randomUUID().slice(0, 8)}@int.dev`;
    const account = await repo.createProfessional(input(email, 'spec_training'));

    // Campos novos vieram do BANCO — a propagacao coluna-a-coluna e o que esta sob teste.
    const persisted = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
      select: {
        whatsapp: true,
        birthDate: true,
        addressStreet: true,
        addressNumber: true,
        addressDistrict: true,
        addressCity: true,
        addressState: true,
        addressZipCode: true,
        addressCountry: true,
        professionalProfile: { select: { tenant: { select: { name: true, type: true } } } },
      },
    });
    expect(persisted.whatsapp).toBe('11987654321');
    expect(persisted.birthDate?.toISOString().slice(0, 10)).toBe('1990-01-15');
    expect(persisted).toMatchObject({
      addressStreet: 'Avenida Paulista',
      addressNumber: '1000',
      addressDistrict: 'Bela Vista',
      addressCity: 'Sao Paulo',
      addressState: 'SP',
      addressZipCode: '01310930',
      addressCountry: 'BR',
    });
    // Tenant SOLO nasce com o NOME do profissional (nao ha mais tenantName).
    expect(persisted.professionalProfile?.tenant).toMatchObject({
      type: 'SOLO',
      name: `Integracao ${email}`,
    });
  });

  it('rollback: specialtyId inexistente nao deixa Account nem Tenant orfaos', async () => {
    const email = `rollback-${randomUUID().slice(0, 8)}@int.dev`;

    await expect(repo.createProfessional(input(email, 'spec_inexistente'))).rejects.toThrow();

    // Nem a conta, nem o tenant que a transacao teria criado sobrevivem.
    const account = await prisma.account.findUnique({ where: { email } });
    expect(account).toBeNull();
    const tenant = await prisma.tenant.findFirst({ where: { name: `Integracao ${email}` } });
    expect(tenant).toBeNull();
  });
});

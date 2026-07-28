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
    name: 'Integracao',
    document: '12345678901',
    documentType: 'CPF' as const,
    tenantName: `Tenant ${email}`,
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

  it('rollback: specialtyId inexistente nao deixa Account nem Tenant orfaos', async () => {
    const email = `rollback-${randomUUID().slice(0, 8)}@int.dev`;

    await expect(repo.createProfessional(input(email, 'spec_inexistente'))).rejects.toThrow();

    // Nem a conta, nem o tenant que a transacao teria criado sobrevivem.
    const account = await prisma.account.findUnique({ where: { email } });
    expect(account).toBeNull();
    const tenant = await prisma.tenant.findFirst({ where: { name: `Tenant ${email}` } });
    expect(tenant).toBeNull();
  });
});

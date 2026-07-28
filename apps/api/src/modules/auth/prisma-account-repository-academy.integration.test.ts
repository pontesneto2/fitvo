import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@fitvo/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CreateCompanyInput } from './account-repository';
import { PrismaAccountRepository } from './prisma-account-repository';

/**
 * Integração — `createCompany` com vertical ACADEMIA (D-141) contra Postgres
 * real. Foco: o que o double in-memory NÃO enxerga — que o `type` do tenant
 * chega ao banco como `ACADEMIA` (o valor de enum que a migração acrescentou),
 * que a ProfessionalSpecialty de CREF nasce na MESMA transação, e que uma falha
 * real reverte tudo.
 */

const prisma = new PrismaClient();
const repo = new PrismaAccountRepository(prisma);
const ORIGIN = { ipAddress: '127.0.0.1', userAgent: 'vitest-integration' };

let trainingSpecialtyId = '';
let personalTrainerSpecialtyId = '';

beforeAll(async () => {
  const training = await prisma.specialty.findUniqueOrThrow({ where: { code: 'TRAINING' } });
  trainingSpecialtyId = training.id;
  const personal = await prisma.specialty.findUniqueOrThrow({
    where: { code: 'PERSONAL_TRAINER' },
  });
  personalTrainerSpecialtyId = personal.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function baseInput(email: string): CreateCompanyInput {
  return {
    tenantType: 'ACADEMIA',
    legalName: `Academia ${email} LTDA`,
    tradeName: `Academia ${email}`,
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
      name: 'Bruno Gestor',
      document: '52998224725',
      whatsapp: '11987654321',
      birthDate: new Date('1988-06-10T00:00:00Z'),
    },
    termsAcceptance: ORIGIN,
  };
}

describe('PrismaAccountRepository — createCompany ACADEMIA (Postgres real)', () => {
  it('MANAGER_ONLY: cria Tenant(ACADEMIA) + admin + membership + termos, SEM ProfessionalSpecialty', async () => {
    const email = `gestor-ac-${randomUUID().slice(0, 8)}@int.dev`;
    const account = await repo.createCompany(baseInput(email));

    const persisted = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
      select: {
        document: true,
        documentType: true,
        professionalProfile: { select: { id: true } },
        clinicMemberships: {
          select: {
            role: true,
            tenant: {
              select: { type: true, name: true, legalName: true, document: true, phone: true },
            },
          },
        },
      },
    });
    expect(persisted).toMatchObject({ document: '52998224725', documentType: 'CPF' });
    expect(persisted.professionalProfile).toBeNull();
    expect(persisted.clinicMemberships).toHaveLength(1);
    // O valor novo do enum (migração `tenant_type_academia`) chegou ao banco.
    expect(persisted.clinicMemberships[0]).toMatchObject({
      role: 'CLINIC_ADMIN',
      tenant: {
        type: 'ACADEMIA',
        name: `Academia ${email}`,
        legalName: `Academia ${email} LTDA`,
        document: '11222333000181',
      },
    });
    const terms = await prisma.termsAcceptanceEvent.count({ where: { accountId: account.id } });
    expect(terms).toBe(2);
  });

  it('MANAGER_PROVIDER Educador Físico: cria ProfessionalProfile + ProfessionalSpecialty CREF', async () => {
    const email = `edfisico-ac-${randomUUID().slice(0, 8)}@int.dev`;
    const account = await repo.createCompany({
      ...baseInput(email),
      professional: {
        specialtyId: trainingSpecialtyId,
        councilDocument: 'CREF-123456',
        councilState: 'SP',
      },
    });

    const profile = await prisma.professionalProfile.findUniqueOrThrow({
      where: { accountId: account.id },
      select: {
        tenant: { select: { type: true } },
        specialties: {
          select: {
            specialtyId: true,
            councilDocument: true,
            councilState: true,
            medicalSpecialty: true,
            verificationStatus: true,
            specialty: { select: { code: true } },
          },
        },
      },
    });
    expect(profile.tenant.type).toBe('ACADEMIA');
    expect(profile.specialties).toHaveLength(1);
    expect(profile.specialties[0]).toMatchObject({
      specialtyId: trainingSpecialtyId,
      councilDocument: 'CREF-123456',
      councilState: 'SP',
      // Nunca há especialidade médica numa academia — não há Médico (D-141).
      medicalSpecialty: null,
      verificationStatus: 'PENDING',
      specialty: { code: 'TRAINING' },
    });
  });

  it('MANAGER_PROVIDER Personal Trainer: também nasce com CREF', async () => {
    const email = `personal-ac-${randomUUID().slice(0, 8)}@int.dev`;
    const account = await repo.createCompany({
      ...baseInput(email),
      professional: {
        specialtyId: personalTrainerSpecialtyId,
        councilDocument: 'CREF-654321',
        councilState: 'RJ',
      },
    });

    const profile = await prisma.professionalProfile.findUniqueOrThrow({
      where: { accountId: account.id },
      select: { specialties: { select: { specialty: { select: { code: true } } } } },
    });
    expect(profile.specialties[0]?.specialty.code).toBe('PERSONAL_TRAINER');
  });

  it('rollback REAL: e-mail duplicado no meio da transação não deixa Tenant órfão', async () => {
    // Falha numa etapa VERDADEIRA da transação: o Tenant é criado ANTES da
    // Account, então a violação do unique de e-mail estoura com o tenant já
    // escrito dentro da tx. Se a atomicidade falhasse, sobraria um tenant órfão
    // — academia fantasma, sem dono, contando como estabelecimento.
    const email = `dup-ac-${randomUUID().slice(0, 8)}@int.dev`;
    await repo.createCompany(baseInput(email));
    const antes = await prisma.tenant.count({ where: { name: `Academia ${email}` } });
    expect(antes).toBe(1);

    await expect(repo.createCompany(baseInput(email))).rejects.toThrow();

    // Continua havendo UM tenant (o do primeiro cadastro), não dois.
    const depois = await prisma.tenant.count({ where: { name: `Academia ${email}` } });
    expect(depois).toBe(1);
  });

  it('rollback REAL: specialtyId fora do catálogo não deixa Account/Tenant órfãos', async () => {
    const email = `rollback-ac-${randomUUID().slice(0, 8)}@int.dev`;

    await expect(
      repo.createCompany({
        ...baseInput(email),
        professional: {
          specialtyId: 'spec_inexistente',
          councilDocument: 'CREF-1',
          councilState: 'SP',
        },
      }),
    ).rejects.toThrow();

    expect(await prisma.account.findUnique({ where: { email } })).toBeNull();
    expect(await prisma.tenant.findFirst({ where: { name: `Academia ${email}` } })).toBeNull();
  });
});

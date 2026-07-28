import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@fitvo/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CreateCompanyInput } from './account-repository';
import { PrismaAccountRepository } from './prisma-account-repository';

/**
 * Integração — `createClinic` do repositório PRISMA contra Postgres real
 * (cadastro público de clínica, D-139). Foco: a atomicidade e o mapeamento —
 * Tenant(CLINIC) + Account(admin) + membership CLINIC_ADMIN (+ perfil
 * profissional SE "também atende") + termos, tudo na MESMA transação, ou nada.
 */

const prisma = new PrismaClient();
const repo = new PrismaAccountRepository(prisma);
const ORIGIN = { ipAddress: '127.0.0.1', userAgent: 'vitest-integration' };

let medicineSpecialtyId = '';

beforeAll(async () => {
  const medicine = await prisma.specialty.findUniqueOrThrow({ where: { code: 'MEDICINE' } });
  medicineSpecialtyId = medicine.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function baseInput(email: string): CreateCompanyInput {
  return {
    tenantType: 'CLINIC',
    legalName: `Clinica ${email} LTDA`,
    tradeName: `Clinica ${email}`,
    cnpj: '11222333000181',
    companyEmail: `contato-${email}`,
    companyPhone: '1133334444',
    address: {
      cep: '01310930',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'Sao Paulo',
      state: 'SP',
      country: 'BR',
    },
    admin: {
      email,
      passwordHash: 'hash-nao-importa',
      name: 'Ana Gestora',
      document: '52998224725',
      whatsapp: '11987654321',
      birthDate: new Date('1985-03-20T00:00:00Z'),
    },
    termsAcceptance: ORIGIN,
  };
}

describe('PrismaAccountRepository — createCompany CLINIC (mapeamento contra Postgres real)', () => {
  it('MANAGER_ONLY: cria Tenant(CLINIC) + admin + membership + termos, SEM ProfessionalSpecialty', async () => {
    const email = `gestor-${randomUUID().slice(0, 8)}@int.dev`;
    const account = await repo.createCompany(baseInput(email));

    // Tudo lido do BANCO — a propagação é o que está sob teste.
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
              select: {
                type: true,
                name: true,
                legalName: true,
                document: true,
                documentType: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    });
    expect(persisted).toMatchObject({ document: '52998224725', documentType: 'CPF' });
    // Gestor-puro NÃO tem perfil profissional.
    expect(persisted.professionalProfile).toBeNull();
    expect(persisted.clinicMemberships).toHaveLength(1);
    expect(persisted.clinicMemberships[0]).toMatchObject({
      role: 'CLINIC_ADMIN',
      tenant: {
        type: 'CLINIC',
        name: `Clinica ${email}`,
        legalName: `Clinica ${email} LTDA`,
        document: '11222333000181',
        documentType: 'CNPJ',
        phone: '1133334444',
        email: `contato-${email}`,
      },
    });
    // Consentimento inicial gravado (D-025) — 2 eventos ACCEPTED na mesma tx.
    const terms = await prisma.termsAcceptanceEvent.count({ where: { accountId: account.id } });
    expect(terms).toBe(2);
  });

  it('MANAGER_PROVIDER médico: cria também ProfessionalProfile + ProfessionalSpecialty com medicalSpecialty', async () => {
    const email = `atende-${randomUUID().slice(0, 8)}@int.dev`;
    const account = await repo.createCompany({
      ...baseInput(email),
      professional: {
        specialtyId: medicineSpecialtyId,
        councilDocument: 'CRM-123456',
        councilState: 'SP',
        medicalSpecialty: 'NUTROLOGIA',
      },
    });

    const profile = await prisma.professionalProfile.findUniqueOrThrow({
      where: { accountId: account.id },
      select: {
        specialties: {
          select: {
            specialtyId: true,
            councilDocument: true,
            medicalSpecialty: true,
            verificationStatus: true,
          },
        },
      },
    });
    expect(profile.specialties).toHaveLength(1);
    expect(profile.specialties[0]).toMatchObject({
      specialtyId: medicineSpecialtyId,
      councilDocument: 'CRM-123456',
      medicalSpecialty: 'NUTROLOGIA',
      verificationStatus: 'PENDING',
    });
    // Continua sendo admin da clínica (membership CLINIC_ADMIN).
    const memberships = await prisma.clinicMembership.count({ where: { accountId: account.id } });
    expect(memberships).toBe(1);
  });

  it('rollback: specialtyId inexistente não deixa Account/Tenant/membership órfãos', async () => {
    const email = `rollback-${randomUUID().slice(0, 8)}@int.dev`;

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

    const account = await prisma.account.findUnique({ where: { email } });
    expect(account).toBeNull();
    const tenant = await prisma.tenant.findFirst({ where: { name: `Clinica ${email}` } });
    expect(tenant).toBeNull();
  });
});

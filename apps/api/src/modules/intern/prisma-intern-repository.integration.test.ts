import { randomUUID } from 'node:crypto';

import {
  type InternArea,
  prisma as extendedPrisma,
  PrismaClient,
  runWithTenantContext,
} from '@fitvo/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashInviteToken } from '../../shared/invite-token';
import type { CreateCompanyInput } from '../auth/account-repository';
import { PrismaAccountRepository } from '../auth/prisma-account-repository';
import type { NewInternAccount } from './intern-repository';
import { PrismaInternRepository } from './prisma-intern-repository';

/**
 * Integração — seat de ESTAGIÁRIO (D-142) contra Postgres real.
 *
 * É aqui que a REGRA LEGAL é provada de verdade: o double in-memory garante o
 * vínculo por TIPO, mas só o banco prova que a FK é NOT NULL e que a transação
 * reverte. "Estagiário sem responsável é irrepresentável" é uma afirmação sobre
 * o SCHEMA — e afirmação sobre schema se prova contra o schema.
 */

const prisma = new PrismaClient();
const accounts = new PrismaAccountRepository(prisma);
const repo = new PrismaInternRepository(prisma);
const ORIGIN = { ipAddress: '127.0.0.1', userAgent: 'vitest-integration' };

let trainingSpecialtyId = '';
let nutritionSpecialtyId = '';
let medicineSpecialtyId = '';

beforeAll(async () => {
  trainingSpecialtyId = (await prisma.specialty.findUniqueOrThrow({ where: { code: 'TRAINING' } }))
    .id;
  nutritionSpecialtyId = (
    await prisma.specialty.findUniqueOrThrow({ where: { code: 'NUTRITION' } })
  ).id;
  medicineSpecialtyId = (await prisma.specialty.findUniqueOrThrow({ where: { code: 'MEDICINE' } }))
    .id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function companyInput(email: string, tenantType: 'ACADEMIA' | 'CLINIC'): CreateCompanyInput {
  return {
    tenantType,
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
      name: 'Gestor Que Atende',
      document: '52998224725',
      whatsapp: '11987654321',
      birthDate: new Date('1988-06-10T00:00:00Z'),
    },
    termsAcceptance: ORIGIN,
  };
}

/**
 * Arranja uma empresa REAL pelo caminho de produção (`createCompany`) com um
 * admin que também atende — ou seja, um responsável de CREF de verdade, com
 * ProfessionalProfile e ProfessionalSpecialty nascidos da mesma transação do
 * cadastro. Devolve tenant + o professionalProfileId do responsável.
 */
async function seedCompanyWithProvider(options: {
  tenantType?: 'ACADEMIA' | 'CLINIC';
  specialtyId?: string;
  councilDocument?: string | null;
}): Promise<{ tenantId: string; professionalProfileId: string }> {
  const email = `provider-${randomUUID().slice(0, 8)}@int.dev`;
  const account = await accounts.createCompany({
    ...companyInput(email, options.tenantType ?? 'ACADEMIA'),
    professional: {
      specialtyId: options.specialtyId ?? trainingSpecialtyId,
      councilDocument: options.councilDocument ?? 'CREF-123456',
      councilState: 'SP',
    },
  });
  const profile = await prisma.professionalProfile.findUniqueOrThrow({
    where: { accountId: account.id },
    select: { id: true, tenantId: true },
  });
  // Cenário "sem conselho preenchido": o cadastro nunca produz isso (o Zod
  // exige), mas dado legado poderia — e o critério de elegibilidade precisa
  // barrar. Zeramos DEPOIS de criado, que é o único jeito de chegar a esse estado.
  if (options.councilDocument === null) {
    await prisma.professionalSpecialty.updateMany({
      where: { professionalProfileId: profile.id },
      data: { councilDocument: null, councilState: null },
    });
  }
  return { tenantId: profile.tenantId, professionalProfileId: profile.id };
}

function internAccount(): NewInternAccount {
  return {
    passwordHash: 'hash-nao-importa',
    name: 'Estagiario Real',
    document: '52998224725',
    documentType: 'CPF',
    whatsapp: '11912345678',
    birthDate: new Date('2003-05-14T00:00:00Z'),
    address: {
      cep: '01310930',
      logradouro: 'Avenida Paulista',
      numero: '1500',
      bairro: 'Bela Vista',
      cidade: 'Sao Paulo',
      state: 'SP',
      country: 'BR',
    },
  };
}

async function createInvite(
  tenantId: string,
  supervisorProfessionalProfileId: string,
  email = `estagiario-${randomUUID().slice(0, 8)}@int.dev`,
  area: InternArea = 'EDUCACAO_FISICA',
): Promise<{ token: string; email: string }> {
  const token = randomUUID();
  await repo.createInvite({
    tenantId,
    email,
    area,
    name: 'Estagiario Pre',
    tokenHash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + 3_600_000),
    supervisorProfessionalProfileId,
  });
  return { token, email };
}

describe('InternProfile — estagiário SEM responsável é irrepresentável (schema)', () => {
  it('o banco RECUSA um intern_profile sem responsável (coluna NOT NULL)', async () => {
    const { tenantId } = await seedCompanyWithProvider({});
    const email = `orfao-${randomUUID().slice(0, 8)}@int.dev`;
    const account = await prisma.account.create({
      data: {
        email,
        passwordHash: 'h',
        name: 'Sem Responsavel',
        document: '52998224725',
        documentType: 'CPF',
      },
      select: { id: true },
    });

    // SQL cru de propósito: o client tipado nem deixa OMITIR o campo, o que já é
    // uma barreira. A pergunta aqui é outra — se alguém contornasse o client,
    // o BANCO ainda recusaria? É isso que torna o estado irrepresentável, e não
    // apenas "não construível pelo nosso código".
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "intern_profile" ("id","accountId","tenantId","area","updatedAt")
         VALUES ($1,$2,$3,'EDUCACAO_FISICA',now())`,
        `ip_${randomUUID().slice(0, 8)}`,
        account.id,
        tenantId,
      ),
    ).rejects.toThrow();

    expect(await prisma.internProfile.count({ where: { accountId: account.id } })).toBe(0);
  });

  it('o banco RECUSA um responsável inexistente (FK)', async () => {
    const { tenantId } = await seedCompanyWithProvider({});
    const email = `fk-${randomUUID().slice(0, 8)}@int.dev`;
    const account = await prisma.account.create({
      data: {
        email,
        passwordHash: 'h',
        name: 'Responsavel Fantasma',
        document: '52998224725',
        documentType: 'CPF',
      },
      select: { id: true },
    });

    await expect(
      prisma.internProfile.create({
        data: {
          account: { connect: { id: account.id } },
          tenant: { connect: { id: tenantId } },
          area: 'EDUCACAO_FISICA',
          supervisor: { connect: { id: 'pp_inexistente' } },
        },
      }),
    ).rejects.toThrow();
  });

  it('o banco RECUSA apagar o responsável de um estagiário (onDelete: Restrict)', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({});
    const { token } = await createInvite(tenantId, professionalProfileId);
    const outcome = await repo.acceptInvite(hashInviteToken(token), internAccount(), ORIGIN);
    expect(outcome.status).toBe('accepted');

    // A derivação congelada (D-142) depende de o responsável CONTINUAR existindo:
    // se ele pudesse sumir, a capacidade do estagiário passaria a derivar do nada.
    await expect(
      prisma.professionalProfile.delete({ where: { id: professionalProfileId } }),
    ).rejects.toThrow();
  });
});

describe('elegibilidade do responsável (D-142) — critério único', () => {
  it('Educador Físico com CREF da academia É elegível e aparece na lista', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({});

    expect(
      await repo.isEligibleSupervisor(tenantId, 'EDUCACAO_FISICA', professionalProfileId),
    ).toBe(true);
    const supervisors = await repo.listEligibleSupervisors(tenantId, 'EDUCACAO_FISICA');
    expect(supervisors).toHaveLength(1);
    expect(supervisors[0]).toMatchObject({
      professionalProfileId,
      specialtyCode: 'TRAINING',
      councilDocument: 'CREF-123456',
      councilState: 'SP',
    });
  });

  it('Nutricionista NÃO é elegível (não supervisiona estagiário de educação física)', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({
      specialtyId: nutritionSpecialtyId,
      councilDocument: 'CRN-123456',
    });

    expect(
      await repo.isEligibleSupervisor(tenantId, 'EDUCACAO_FISICA', professionalProfileId),
    ).toBe(false);
    expect(await repo.listEligibleSupervisors(tenantId, 'EDUCACAO_FISICA')).toHaveLength(0);
  });

  it('CREF SEM conselho preenchido NÃO é elegível (D-138 — formato é o mínimo)', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({
      councilDocument: null,
    });

    expect(
      await repo.isEligibleSupervisor(tenantId, 'EDUCACAO_FISICA', professionalProfileId),
    ).toBe(false);
    expect(await repo.listEligibleSupervisors(tenantId, 'EDUCACAO_FISICA')).toHaveLength(0);
  });

  it('D-143: profissional de CLÍNICA com CREF É elegível — a vertical não decide mais', async () => {
    // Regra invertida em relação ao D-142: quem decide é o CONSELHO do
    // supervisor, não o tipo do tenant. Uma clínica com um educador físico no
    // quadro pode, sim, ter estagiário de educação física.
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({
      tenantType: 'CLINIC',
    });

    expect(
      await repo.isEligibleSupervisor(tenantId, 'EDUCACAO_FISICA', professionalProfileId),
    ).toBe(true);
    expect(await repo.listEligibleSupervisors(tenantId, 'EDUCACAO_FISICA')).toHaveLength(1);
  });

  it('responsável de OUTRA academia não é elegível neste tenant (D-002)', async () => {
    const a = await seedCompanyWithProvider({});
    const b = await seedCompanyWithProvider({});

    expect(
      await repo.isEligibleSupervisor(a.tenantId, 'EDUCACAO_FISICA', b.professionalProfileId),
    ).toBe(false);
  });
});

describe('D-143 — a ÁREA decide qual conselho supervisiona', () => {
  it('NUTRICAO com supervisor CREF → INELEGÍVEL (conselho não bate a área)', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({});

    // O mesmo profissional é elegível para a área DELE e inelegível para outra —
    // é a área, e só ela, que muda o veredito.
    expect(
      await repo.isEligibleSupervisor(tenantId, 'EDUCACAO_FISICA', professionalProfileId),
    ).toBe(true);
    expect(await repo.isEligibleSupervisor(tenantId, 'NUTRICAO', professionalProfileId)).toBe(
      false,
    );
    expect(await repo.listEligibleSupervisors(tenantId, 'NUTRICAO')).toHaveLength(0);
  });

  it('NUTRICAO com supervisor CRN → elegível, seat nasce com area NUTRICAO', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({
      tenantType: 'CLINIC',
      specialtyId: nutritionSpecialtyId,
      councilDocument: 'CRN-123456',
    });
    expect(await repo.isEligibleSupervisor(tenantId, 'NUTRICAO', professionalProfileId)).toBe(true);

    const { token, email } = await createInvite(
      tenantId,
      professionalProfileId,
      undefined,
      'NUTRICAO',
    );
    const outcome = await repo.acceptInvite(hashInviteToken(token), internAccount(), ORIGIN);
    expect(outcome).toMatchObject({
      status: 'accepted',
      area: 'NUTRICAO',
      supervisorProfessionalProfileId: professionalProfileId,
    });

    const persisted = await prisma.account.findUniqueOrThrow({
      where: { email },
      select: {
        internProfile: {
          select: {
            area: true,
            tenantId: true,
            supervisorProfessionalProfileId: true,
            supervisor: {
              select: { specialties: { select: { specialty: { select: { code: true } } } } },
            },
          },
        },
      },
    });
    expect(persisted.internProfile).toMatchObject({
      area: 'NUTRICAO',
      tenantId,
      supervisorProfessionalProfileId: professionalProfileId,
    });
    // A capacidade deriva de um CRN — alcançável em leitura a partir do seat.
    expect(persisted.internProfile?.supervisor.specialties[0]?.specialty.code).toBe('NUTRITION');
  });

  it('MEDICINA com supervisor CRM → elegível, seat nasce com area MEDICINA', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({
      tenantType: 'CLINIC',
      specialtyId: medicineSpecialtyId,
      councilDocument: 'CRM-123456',
    });
    expect(await repo.isEligibleSupervisor(tenantId, 'MEDICINA', professionalProfileId)).toBe(true);

    const { token } = await createInvite(tenantId, professionalProfileId, undefined, 'MEDICINA');
    const outcome = await repo.acceptInvite(hashInviteToken(token), internAccount(), ORIGIN);
    expect(outcome).toMatchObject({ status: 'accepted', area: 'MEDICINA' });
  });

  it('MEDICINA com supervisor CRN → inelegível (nutricionista não supervisiona medicina)', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({
      tenantType: 'CLINIC',
      specialtyId: nutritionSpecialtyId,
      councilDocument: 'CRN-123456',
    });

    expect(await repo.isEligibleSupervisor(tenantId, 'MEDICINA', professionalProfileId)).toBe(
      false,
    );
  });

  it('REGRESSÃO D-142: EDUCACAO_FISICA com CREF em ACADEMIA continua funcionando', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({
      tenantType: 'ACADEMIA',
    });
    const { token } = await createInvite(
      tenantId,
      professionalProfileId,
      undefined,
      'EDUCACAO_FISICA',
    );

    const outcome = await repo.acceptInvite(hashInviteToken(token), internAccount(), ORIGIN);
    expect(outcome).toMatchObject({
      status: 'accepted',
      area: 'EDUCACAO_FISICA',
      supervisorProfessionalProfileId: professionalProfileId,
      created: true,
    });
  });

  it('estagiário de NUTRIÇÃO existe em CLINIC — soltou da academia (D-143)', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({
      tenantType: 'CLINIC',
      specialtyId: nutritionSpecialtyId,
      councilDocument: 'CRN-999999',
    });
    const { token } = await createInvite(tenantId, professionalProfileId, undefined, 'NUTRICAO');

    const outcome = await repo.acceptInvite(hashInviteToken(token), internAccount(), ORIGIN);
    expect(outcome.status).toBe('accepted');

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { type: true },
    });
    expect(tenant.type).toBe('CLINIC');
    expect(await prisma.internProfile.count({ where: { tenantId, area: 'NUTRICAO' } })).toBe(1);
  });

  it('a listagem por área projeta o conselho DAQUELA área, não outro do mesmo profissional', async () => {
    // Profissional com DOIS conselhos (CREF + CRN) no mesmo perfil: aparece nas
    // duas listas, mas cada uma tem de exibir a credencial correspondente.
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({
      tenantType: 'CLINIC',
    });
    await prisma.professionalSpecialty.create({
      data: {
        professionalProfileId,
        specialtyId: nutritionSpecialtyId,
        councilDocument: 'CRN-555555',
        councilState: 'SP',
      },
    });

    const cref = await repo.listEligibleSupervisors(tenantId, 'EDUCACAO_FISICA');
    const crn = await repo.listEligibleSupervisors(tenantId, 'NUTRICAO');
    expect(cref[0]).toMatchObject({ specialtyCode: 'TRAINING', councilDocument: 'CREF-123456' });
    expect(crn[0]).toMatchObject({ specialtyCode: 'NUTRITION', councilDocument: 'CRN-555555' });
  });
});

describe('aceite do estagiário (Fase B) contra Postgres real', () => {
  it('cria a conta + o seat com o responsável DO CONVITE e grava os termos', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({});
    const { token, email } = await createInvite(tenantId, professionalProfileId);

    const outcome = await repo.acceptInvite(hashInviteToken(token), internAccount(), ORIGIN);
    expect(outcome).toMatchObject({
      status: 'accepted',
      tenantId,
      supervisorProfessionalProfileId: professionalProfileId,
      created: true,
    });

    // Tudo lido do BANCO — a propagação é o que está sob teste.
    const persisted = await prisma.account.findUniqueOrThrow({
      where: { email },
      select: {
        name: true,
        document: true,
        whatsapp: true,
        birthDate: true,
        addressCity: true,
        addressState: true,
        // Estagiário NÃO é profissional: nenhum perfil profissional nasce aqui.
        professionalProfile: { select: { id: true } },
        internProfile: {
          select: {
            tenantId: true,
            supervisorProfessionalProfileId: true,
            supervisor: {
              select: { specialties: { select: { councilDocument: true } } },
            },
          },
        },
      },
    });
    expect(persisted.professionalProfile).toBeNull();
    expect(persisted).toMatchObject({
      name: 'Estagiario Real',
      whatsapp: '11912345678',
      addressCity: 'Sao Paulo',
      addressState: 'SP',
    });
    expect(persisted.internProfile).toMatchObject({
      tenantId,
      supervisorProfessionalProfileId: professionalProfileId,
    });
    // A capacidade DERIVA daqui: o CREF do responsável é alcançável em leitura
    // a partir do seat, sem cópia no estagiário (D-142).
    expect(persisted.internProfile?.supervisor.specialties[0]?.councilDocument).toBe('CREF-123456');

    const accountId = (outcome as { accountId: string }).accountId;
    expect(await prisma.termsAcceptanceEvent.count({ where: { accountId } })).toBe(2);
  });

  it('conta EXISTENTE: anexa o seat e NÃO regrava termos (D-025 — só conta nova)', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({});
    // Conta que já nasceu por outro caminho e já consentiu no próprio cadastro.
    const email = `multi-papel-${randomUUID().slice(0, 8)}@int.dev`;
    const existing = await accounts.createCompany(companyInput(email, 'ACADEMIA'));
    const antes = await prisma.termsAcceptanceEvent.count({ where: { accountId: existing.id } });
    expect(antes).toBe(2);

    const { token } = await createInvite(tenantId, professionalProfileId, email);
    const outcome = await repo.acceptInvite(hashInviteToken(token), internAccount(), ORIGIN);

    expect(outcome).toMatchObject({ status: 'accepted', accountId: existing.id, created: false });
    expect(await prisma.internProfile.count({ where: { accountId: existing.id } })).toBe(1);
    // Continua 2: nenhum evento novo para quem já havia consentido.
    const depois = await prisma.termsAcceptanceEvent.count({ where: { accountId: existing.id } });
    expect(depois).toBe(2);
  });

  it('conta que JÁ é estagiária → conflict, sem segundo seat', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({});
    const { token, email } = await createInvite(tenantId, professionalProfileId);
    await repo.acceptInvite(hashInviteToken(token), internAccount(), ORIGIN);

    const segundo = await createInvite(tenantId, professionalProfileId, email);
    const outcome = await repo.acceptInvite(
      hashInviteToken(segundo.token),
      internAccount(),
      ORIGIN,
    );

    expect(outcome.status).toBe('conflict');
    const account = await prisma.account.findUniqueOrThrow({ where: { email } });
    expect(await prisma.internProfile.count({ where: { accountId: account.id } })).toBe(1);
  });

  it('token de uso ÚNICO: o segundo aceite do mesmo convite é inválido', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({});
    const { token } = await createInvite(tenantId, professionalProfileId);

    expect((await repo.acceptInvite(hashInviteToken(token), internAccount(), ORIGIN)).status).toBe(
      'accepted',
    );
    expect((await repo.acceptInvite(hashInviteToken(token), internAccount(), ORIGIN)).status).toBe(
      'invalid',
    );
  });

  it('rollback REAL: falha no meio da transação não deixa convite consumido nem conta órfã', async () => {
    const { tenantId, professionalProfileId } = await seedCompanyWithProvider({});
    const { token, email } = await createInvite(tenantId, professionalProfileId);

    // Falha VERDADEIRA numa etapa da transação: o convite JÁ foi marcado
    // ACCEPTED (escrita bem-sucedida) e a escrita da Account estoura em seguida,
    // com uma data de nascimento inválida. Se a atomicidade falhasse, o convite
    // ficaria queimado (ACCEPTED sem ninguém do outro lado) e o estagiário
    // perderia o acesso para sempre — sem conta e sem convite válido.
    await expect(
      repo.acceptInvite(
        hashInviteToken(token),
        { ...internAccount(), birthDate: new Date('data-que-nao-existe') },
        ORIGIN,
      ),
    ).rejects.toThrow();

    expect(await prisma.account.findUnique({ where: { email } })).toBeNull();
    const invite = await prisma.internInvite.findFirstOrThrow({ where: { tenantId, email } });
    // O convite VOLTOU a PENDING — a marcação de consumido reverteu junto.
    expect(invite.status).toBe('PENDING');

    // E o convite continua utilizável: o estagiário não foi punido pela falha.
    const outcome = await repo.acceptInvite(hashInviteToken(token), internAccount(), ORIGIN);
    expect(outcome.status).toBe('accepted');
  });
});

describe('D-151 (slice 2) — eligibleSupervisorWhere (predicado de relação aninhada) sob a extension', () => {
  // Repositorio a parte, com o cliente EXTENDIDO (@fitvo/database `prisma`) —
  // o `repo` do topo do arquivo usa um PrismaClient CRU de proposito (prova
  // regra de schema, nao isolamento). Este describe prova especificamente
  // que a extension NAO quebra nem enfraquece o predicado aninhado
  // (`tenant: {...}` + `specialties: { some: {...} } }`) que ja filtra por
  // tenantId manualmente (D-002) — a nota de implementacao do ADR-0017 pedia
  // exatamente essa auditoria.
  const extendedRepo = new PrismaInternRepository(extendedPrisma);

  it('injecao da extension + eligibleSupervisorWhere juntos: continua achando o supervisor do PROPRIO tenant e nunca o de outro', async () => {
    const a = await seedCompanyWithProvider({});
    const b = await seedCompanyWithProvider({});

    // Contexto de A aberto (D-150) — a extension vai injetar tenantId=A em
    // QUALQUER query de professionalProfile feita por dentro deste callback,
    // por cima do filtro manual que eligibleSupervisorWhere ja aplica.
    const supervisorsAsA = await runWithTenantContext(a.tenantId, async () =>
      extendedRepo.listEligibleSupervisors(a.tenantId, 'EDUCACAO_FISICA'),
    );
    expect(supervisorsAsA).toHaveLength(1);
    expect(supervisorsAsA[0]!.professionalProfileId).toBe(a.professionalProfileId);

    const eligibleAsA = await runWithTenantContext(a.tenantId, async () =>
      extendedRepo.isEligibleSupervisor(a.tenantId, 'EDUCACAO_FISICA', b.professionalProfileId),
    );
    expect(eligibleAsA).toBe(false);

    // Contexto de B aberto — simetria: B nunca ve o supervisor de A.
    const supervisorsAsB = await runWithTenantContext(b.tenantId, async () =>
      extendedRepo.listEligibleSupervisors(b.tenantId, 'EDUCACAO_FISICA'),
    );
    expect(supervisorsAsB).toHaveLength(1);
    expect(supervisorsAsB[0]!.professionalProfileId).toBe(b.professionalProfileId);
  });
});

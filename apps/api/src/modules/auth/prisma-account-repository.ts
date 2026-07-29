import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import { recordInitialTermsAcceptance } from '../terms/initial-terms-acceptance';
import type {
  AccountRecord,
  AccountRepository,
  AccountWithProfileRecord,
  CompleteProfileInput,
  CreateCompanyInput,
  CreateProfessionalInput,
} from './account-repository';

const ACCOUNT_PROJECTION = {
  id: true,
  email: true,
  passwordHash: true,
  name: true,
  socialName: true,
  emailVerifiedAt: true,
} as const;

/**
 * Projecao do gate de completar-perfil (spec §5): a conta + exatamente as
 * colunas que `deriveProfileComplete` le. Nao vira a projecao padrao para nao
 * carregar endereco em toda autenticacao.
 */
const ACCOUNT_WITH_PROFILE_PROJECTION = {
  ...ACCOUNT_PROJECTION,
  birthDate: true,
  whatsapp: true,
  addressStreet: true,
  addressNumber: true,
  addressDistrict: true,
  addressCity: true,
  addressState: true,
  addressZipCode: true,
} as const;

/** Implementacao Prisma (infra) do repositorio de identidade. */
export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  findByEmail(email: string): Promise<AccountRecord | null> {
    return this.db.account.findUnique({ where: { email }, select: ACCOUNT_PROJECTION });
  }

  findById(id: string): Promise<AccountRecord | null> {
    return this.db.account.findUnique({ where: { id }, select: ACCOUNT_PROJECTION });
  }

  findByIdWithProfile(id: string): Promise<AccountWithProfileRecord | null> {
    return this.db.account.findUnique({
      where: { id },
      select: ACCOUNT_WITH_PROFILE_PROJECTION,
    });
  }

  /**
   * Preenche SO o que veio (spec §5). `undefined` significa "nao mexer": um
   * `update` do Prisma ignora chaves ausentes, entao quem manda so o WhatsApp
   * nao zera o endereco por omissao — o que seria um jeito silencioso de
   * DESCOMPLETAR um perfil pelo endpoint que existe para completa-lo.
   *
   * Nao toca em termos (completar perfil nao e novo consentimento — D-025),
   * nem em documento/e-mail (identidade, nao "dado faltando").
   */
  completeProfile(id: string, input: CompleteProfileInput): Promise<AccountWithProfileRecord> {
    return this.db.account.update({
      where: { id },
      data: {
        ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
        ...(input.birthDate !== undefined ? { birthDate: input.birthDate } : {}),
        ...(input.address !== undefined
          ? {
              addressStreet: input.address.logradouro,
              addressNumber: input.address.numero,
              addressComplement: input.address.complemento ?? null,
              addressDistrict: input.address.bairro,
              addressCity: input.address.cidade,
              addressState: input.address.state,
              addressZipCode: input.address.cep,
              addressCountry: input.address.country,
            }
          : {}),
      },
      select: ACCOUNT_WITH_PROFILE_PROJECTION,
    });
  }

  createProfessional(input: CreateProfessionalInput): Promise<AccountRecord> {
    return this.db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        // Tenant SOLO herda o NOME do profissional — nao ha mais campo
        // tenantName no cadastro (ADR-0015). Nome comercial e preferencia de
        // perfil, fora deste slice.
        data: { type: 'SOLO', name: input.name },
      });
      // A ProfessionalSpecialty nasce ANINHADA na mesma escrita do
      // professionalProfile — uma unica operacao Prisma, dentro da mesma
      // $transaction: se specialtyId nao existir no catalogo (FK Restrict),
      // o Prisma reprova a escrita inteira e a transacao inteira reverte —
      // nem Tenant nem Account sobrevivem (D-137, mesma garantia atomica do
      // aceite de convite). whatsapp/birthDate/address* moram na Account
      // (atributos da PESSOA — D-044) e sao gravados nesta MESMA escrita.
      const account = await tx.account.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          name: input.name,
          socialName: input.socialName ?? null,
          gender: input.gender ?? null,
          document: input.document,
          documentType: input.documentType,
          whatsapp: input.whatsapp,
          birthDate: input.birthDate,
          addressStreet: input.address.logradouro,
          addressNumber: input.address.numero,
          addressComplement: input.address.complemento ?? null,
          addressDistrict: input.address.bairro,
          addressCity: input.address.cidade,
          addressState: input.address.state,
          addressZipCode: input.address.cep,
          addressCountry: input.address.country,
          professionalProfile: {
            create: {
              tenant: { connect: { id: tenant.id } },
              specialties: {
                create: {
                  specialtyId: input.specialtyId,
                  councilDocument: input.councilDocument,
                  councilState: input.councilState,
                },
              },
            },
          },
        },
        select: ACCOUNT_PROJECTION,
      });
      await recordInitialTermsAcceptance(tx, account.id, input.termsAcceptance);
      return account;
    });
  }

  createCompany(input: CreateCompanyInput): Promise<AccountRecord> {
    return this.db.$transaction(async (tx) => {
      // Tenant de empresa (CLINIC ou ACADEMIA — a vertical vem do input, a
      // transação é a mesma): name = nome fantasia (exibição), legalName = razão
      // social (fiscal). Endereço/contato da EMPRESA (colunas inline — D-126).
      const tenant = await tx.tenant.create({
        data: {
          type: input.tenantType,
          name: input.tradeName,
          legalName: input.legalName,
          document: input.cnpj,
          documentType: 'CNPJ',
          addressStreet: input.address.logradouro,
          addressNumber: input.address.numero,
          addressComplement: input.address.complemento ?? null,
          addressDistrict: input.address.bairro,
          addressCity: input.address.cidade,
          addressState: input.address.state,
          addressZipCode: input.address.cep,
          phone: input.companyPhone,
          email: input.companyEmail,
        },
      });
      // "Também atende" (MANAGER_PROVIDER): perfil profissional + especialidade
      // NASCEM na MESMA escrita da conta. Gestor-puro → undefined (só a
      // membership CLINIC_ADMIN abaixo). specialtyId já resolvido do code pelo
      // service; specialty via connect (FK Restrict): code inexistente reprova a
      // transação inteira.
      const professionalProfile = input.professional
        ? {
            create: {
              tenant: { connect: { id: tenant.id } },
              specialties: {
                create: {
                  specialty: { connect: { id: input.professional.specialtyId } },
                  councilDocument: input.professional.councilDocument,
                  councilState: input.professional.councilState,
                  medicalSpecialty: input.professional.medicalSpecialty ?? null,
                },
              },
            },
          }
        : undefined;
      // Admin: pessoa física (CPF). Membership CLINIC_ADMIN SEMPRE; o perfil
      // profissional só quando "também atende". Tudo aninhado numa escrita.
      const account = await tx.account.create({
        data: {
          email: input.admin.email,
          passwordHash: input.admin.passwordHash,
          name: input.admin.name,
          socialName: input.admin.socialName ?? null,
          gender: input.admin.gender ?? null,
          document: input.admin.document,
          documentType: 'CPF',
          whatsapp: input.admin.whatsapp,
          birthDate: input.admin.birthDate,
          clinicMemberships: {
            create: { tenant: { connect: { id: tenant.id } }, role: 'CLINIC_ADMIN' },
          },
          ...(professionalProfile ? { professionalProfile } : {}),
        },
        select: ACCOUNT_PROJECTION,
      });
      // Conta NOVA (porta pública de nascimento — D-139/D-141): grava o
      // consentimento inicial (D-025) na MESMA transação. Qualquer falha
      // acima/abaixo reverte tudo — nem Tenant, nem Account, nem membership,
      // nem specialty sobrevivem.
      await recordInitialTermsAcceptance(tx, account.id, input.termsAcceptance);
      return account;
    });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.db.account.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db.account.update({ where: { id }, data: { passwordHash } });
  }
}

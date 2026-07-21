import type { Prisma, PrismaClient, TermsDocumentSlug } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import type {
  AccountRecord,
  AccountRepository,
  CreatePatientInput,
  CreateProfessionalInput,
  TermsAcceptanceOrigin,
} from './account-repository';

const ACCOUNT_PROJECTION = {
  id: true,
  email: true,
  passwordHash: true,
  name: true,
  emailVerifiedAt: true,
} as const;

/** Documentos com aceite obrigatorio no cadastro (D-025). */
const REQUIRED_TERMS_DOCUMENTS: TermsDocumentSlug[] = ['TERMS_OF_USE', 'PRIVACY_POLICY'];

/** Implementacao Prisma (infra) do repositorio de identidade. */
export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  findByEmail(email: string): Promise<AccountRecord | null> {
    return this.db.account.findUnique({ where: { email }, select: ACCOUNT_PROJECTION });
  }

  findById(id: string): Promise<AccountRecord | null> {
    return this.db.account.findUnique({ where: { id }, select: ACCOUNT_PROJECTION });
  }

  createProfessional(input: CreateProfessionalInput): Promise<AccountRecord> {
    return this.db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { type: 'SOLO', name: input.tenantName },
      });
      const account = await tx.account.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          name: input.name,
          document: input.document,
          documentType: input.documentType,
          professionalProfile: { create: { tenant: { connect: { id: tenant.id } } } },
        },
        select: ACCOUNT_PROJECTION,
      });
      await this.recordInitialTermsAcceptance(tx, account.id, input.termsAcceptance);
      return account;
    });
  }

  createPatient(input: CreatePatientInput): Promise<AccountRecord> {
    return this.db.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          name: input.name,
          document: input.document,
          documentType: 'CPF',
          patientProfile: { create: {} },
        },
        select: ACCOUNT_PROJECTION,
      });
      await this.recordInitialTermsAcceptance(tx, account.id, input.termsAcceptance);
      return account;
    });
  }

  /**
   * Aceite INICIAL dos termos no cadastro (D-025), na MESMA transacao da
   * conta: um evento ACCEPTED por documento obrigatorio, apontando para a
   * versao publicada mais recente (lida DENTRO desta transacao — nao ha
   * "isCurrent" separado, a ordenacao por `publishedAt` basta; publicar uma
   * versao nova no meio de um cadastro em voo e um risco aceito para este
   * escopo, nao vale a complexidade extra de travar o catalogo).
   */
  private async recordInitialTermsAcceptance(
    tx: Prisma.TransactionClient,
    accountId: string,
    origin: TermsAcceptanceOrigin,
  ): Promise<void> {
    const now = new Date();
    for (const slug of REQUIRED_TERMS_DOCUMENTS) {
      const currentVersion = await tx.termsVersion.findFirst({
        where: { document: { slug } },
        orderBy: { publishedAt: 'desc' },
        select: { id: true },
      });
      if (!currentVersion) {
        throw new Error(
          `Nenhuma versao publicada para o documento de termos ${slug} — catalogo nao semeado.`,
        );
      }
      await tx.termsAcceptanceEvent.create({
        data: {
          accountId,
          termsVersionId: currentVersion.id,
          type: 'ACCEPTED',
          occurredAt: now,
          ipAddress: origin.ipAddress,
          userAgent: origin.userAgent,
        },
      });
    }
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.db.account.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db.account.update({ where: { id }, data: { passwordHash } });
  }
}

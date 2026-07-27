import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import { recordInitialTermsAcceptance } from '../terms/initial-terms-acceptance';
import type {
  AccountRecord,
  AccountRepository,
  CreateProfessionalInput,
} from './account-repository';

const ACCOUNT_PROJECTION = {
  id: true,
  email: true,
  passwordHash: true,
  name: true,
  emailVerifiedAt: true,
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

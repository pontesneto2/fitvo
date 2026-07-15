import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import type {
  AcceptInviteOutcome,
  ClinicProfessionalRecord,
  ClinicRepository,
  CreateInviteInput,
  NewProfessionalAccount,
  ProfessionalInviteRecord,
} from './clinic-repository';

const INVITE_PROJECTION = {
  id: true,
  tenantId: true,
  email: true,
  status: true,
  expiresAt: true,
  createdAt: true,
} as const;

/** Implementacao Prisma (infra) do repositorio da clinica. */
export class PrismaClinicRepository implements ClinicRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  findMembership(accountId: string, tenantId: string): Promise<{ role: 'CLINIC_ADMIN' } | null> {
    return this.db.clinicMembership.findUnique({
      where: { accountId_tenantId: { accountId, tenantId } },
      select: { role: true },
    });
  }

  createInvite(input: CreateInviteInput): Promise<ProfessionalInviteRecord> {
    return this.db.professionalInvite.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      select: INVITE_PROJECTION,
    });
  }

  findPendingInviteByEmail(
    tenantId: string,
    email: string,
  ): Promise<ProfessionalInviteRecord | null> {
    return this.db.professionalInvite.findFirst({
      where: { tenantId, email, status: 'PENDING' },
      select: INVITE_PROJECTION,
    });
  }

  listPendingInvites(tenantId: string): Promise<ProfessionalInviteRecord[]> {
    return this.db.professionalInvite.findMany({
      where: { tenantId, status: 'PENDING' },
      select: INVITE_PROJECTION,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listProfessionals(tenantId: string): Promise<ClinicProfessionalRecord[]> {
    const rows = await this.db.professionalProfile.findMany({
      where: { tenantId },
      select: {
        id: true,
        accountId: true,
        displayName: true,
        createdAt: true,
        account: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      professionalProfileId: row.id,
      accountId: row.accountId,
      name: row.account.name,
      email: row.account.email,
      displayName: row.displayName,
      joinedAt: row.createdAt,
    }));
  }

  async revokeInvite(tenantId: string, inviteId: string): Promise<boolean> {
    const result = await this.db.professionalInvite.updateMany({
      where: { id: inviteId, tenantId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    return result.count > 0;
  }

  acceptInvite(tokenHash: string, account: NewProfessionalAccount): Promise<AcceptInviteOutcome> {
    return this.db.$transaction(async (tx) => {
      const invite = await tx.professionalInvite.findUnique({
        where: { tokenHash },
        select: { id: true, tenantId: true, email: true, status: true, expiresAt: true },
      });
      if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
        return { status: 'invalid' };
      }

      const existing = await tx.account.findUnique({
        where: { email: invite.email },
        select: { id: true, professionalProfile: { select: { id: true } } },
      });
      if (existing?.professionalProfile) {
        return { status: 'conflict' };
      }

      // Uso unico race-safe: so um aceite muda PENDING -> ACCEPTED.
      const claimed = await tx.professionalInvite.updateMany({
        where: { id: invite.id, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      if (claimed.count === 0) {
        return { status: 'invalid' };
      }

      if (existing) {
        await tx.professionalProfile.create({
          data: { accountId: existing.id, tenantId: invite.tenantId },
        });
        return {
          status: 'accepted',
          tenantId: invite.tenantId,
          accountId: existing.id,
          created: false,
        };
      }

      const created = await tx.account.create({
        data: {
          email: invite.email,
          passwordHash: account.passwordHash,
          name: account.name,
          document: account.document,
          documentType: account.documentType,
          professionalProfile: { create: { tenant: { connect: { id: invite.tenantId } } } },
        },
        select: { id: true },
      });
      return {
        status: 'accepted',
        tenantId: invite.tenantId,
        accountId: created.id,
        created: true,
      };
    });
  }
}

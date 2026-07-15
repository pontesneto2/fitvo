import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import type {
  AcceptPatientInviteOutcome,
  BondRecord,
  CreatePatientInviteInput,
  NewPatientAccount,
  PatientInviteRecord,
  PatientRepository,
} from './patient-repository';

const INVITE_PROJECTION = {
  id: true,
  tenantId: true,
  professionalProfileId: true,
  specialtyId: true,
  email: true,
  status: true,
  expiresAt: true,
  createdAt: true,
} as const;

/** Implementacao Prisma (infra) do repositorio de paciente/vinculo. */
export class PrismaPatientRepository implements PatientRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null> {
    const profile = await this.db.professionalProfile.findFirst({
      where: { accountId, tenantId },
      select: { id: true },
    });
    return profile ? { professionalProfileId: profile.id } : null;
  }

  async specialtyExists(specialtyId: string): Promise<boolean> {
    const specialty = await this.db.specialty.findUnique({
      where: { id: specialtyId },
      select: { id: true },
    });
    return specialty !== null;
  }

  async professionalHasSpecialty(
    professionalProfileId: string,
    specialtyId: string,
  ): Promise<boolean> {
    const row = await this.db.professionalSpecialty.findUnique({
      where: { professionalProfileId_specialtyId: { professionalProfileId, specialtyId } },
      select: { id: true },
    });
    return row !== null;
  }

  createInvite(input: CreatePatientInviteInput): Promise<PatientInviteRecord> {
    return this.db.patientInvite.create({
      data: {
        tenantId: input.tenantId,
        professionalProfileId: input.professionalProfileId,
        specialtyId: input.specialtyId,
        email: input.email,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      select: INVITE_PROJECTION,
    });
  }

  findPendingInvite(
    tenantId: string,
    professionalProfileId: string,
    email: string,
    specialtyId: string,
  ): Promise<PatientInviteRecord | null> {
    return this.db.patientInvite.findFirst({
      where: { tenantId, professionalProfileId, email, specialtyId, status: 'PENDING' },
      select: INVITE_PROJECTION,
    });
  }

  listPendingInvites(
    tenantId: string,
    professionalProfileId: string,
  ): Promise<PatientInviteRecord[]> {
    return this.db.patientInvite.findMany({
      where: { tenantId, professionalProfileId, status: 'PENDING' },
      select: INVITE_PROJECTION,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listActiveBonds(tenantId: string, professionalProfileId: string): Promise<BondRecord[]> {
    const rows = await this.db.bond.findMany({
      where: { tenantId, professionalProfileId, status: 'ACTIVE' },
      select: {
        id: true,
        patientProfileId: true,
        specialtyId: true,
        status: true,
        createdAt: true,
        archivedAt: true,
        patientProfile: { select: { account: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      patientProfileId: row.patientProfileId,
      patientName: row.patientProfile.account.name,
      patientEmail: row.patientProfile.account.email,
      specialtyId: row.specialtyId,
      status: row.status,
      createdAt: row.createdAt,
      archivedAt: row.archivedAt,
    }));
  }

  async resendInvite(
    tenantId: string,
    professionalProfileId: string,
    inviteId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<PatientInviteRecord | null> {
    // Rotaciona token + estende validade NA MESMA linha, so se ainda PENDING (D-055).
    const result = await this.db.patientInvite.updateMany({
      where: { id: inviteId, tenantId, professionalProfileId, status: 'PENDING' },
      data: { tokenHash, expiresAt },
    });
    if (result.count === 0) {
      return null;
    }
    return this.db.patientInvite.findUnique({ where: { id: inviteId }, select: INVITE_PROJECTION });
  }

  async revokeInvite(
    tenantId: string,
    professionalProfileId: string,
    inviteId: string,
  ): Promise<boolean> {
    const result = await this.db.patientInvite.updateMany({
      where: { id: inviteId, tenantId, professionalProfileId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    return result.count > 0;
  }

  async archiveBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
  ): Promise<boolean> {
    const result = await this.db.bond.updateMany({
      where: { id: bondId, tenantId, professionalProfileId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    return result.count > 0;
  }

  acceptInvite(tokenHash: string, account: NewPatientAccount): Promise<AcceptPatientInviteOutcome> {
    return this.db.$transaction(async (tx) => {
      const invite = await tx.patientInvite.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          tenantId: true,
          professionalProfileId: true,
          specialtyId: true,
          email: true,
          status: true,
          expiresAt: true,
        },
      });
      if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
        return { status: 'invalid' };
      }

      const existing = await tx.account.findUnique({
        where: { email: invite.email },
        select: { id: true, patientProfile: { select: { id: true } } },
      });

      // Conflito de vinculo so e possivel quando ja existe perfil de paciente.
      // Checado ANTES de reivindicar o convite: nada foi mutado ainda (safe).
      if (existing?.patientProfile) {
        const bondExists = await tx.bond.findUnique({
          where: {
            patientProfileId_professionalProfileId_specialtyId: {
              patientProfileId: existing.patientProfile.id,
              professionalProfileId: invite.professionalProfileId,
              specialtyId: invite.specialtyId,
            },
          },
          select: { id: true },
        });
        if (bondExists) {
          return { status: 'bond-conflict' };
        }
      }

      // Uso unico race-safe: so um aceite muda PENDING -> ACCEPTED.
      const claimed = await tx.patientInvite.updateMany({
        where: { id: invite.id, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      if (claimed.count === 0) {
        return { status: 'invalid' };
      }

      let accountId: string;
      let patientProfileId: string;
      let created: boolean;

      if (!existing) {
        const createdAccount = await tx.account.create({
          data: {
            email: invite.email,
            passwordHash: account.passwordHash,
            name: account.name,
            document: account.document,
            documentType: 'CPF',
            patientProfile: { create: {} },
          },
          select: { id: true, patientProfile: { select: { id: true } } },
        });
        accountId = createdAccount.id;
        patientProfileId = createdAccount.patientProfile!.id;
        created = true;
      } else if (existing.patientProfile) {
        accountId = existing.id;
        patientProfileId = existing.patientProfile.id;
        created = false;
      } else {
        const profile = await tx.patientProfile.create({
          data: { accountId: existing.id },
          select: { id: true },
        });
        accountId = existing.id;
        patientProfileId = profile.id;
        created = false;
      }

      const bond = await tx.bond.create({
        data: {
          tenantId: invite.tenantId,
          patientProfileId,
          professionalProfileId: invite.professionalProfileId,
          specialtyId: invite.specialtyId,
        },
        select: { id: true },
      });

      return {
        status: 'accepted',
        tenantId: invite.tenantId,
        accountId,
        patientProfileId,
        professionalProfileId: invite.professionalProfileId,
        bondId: bond.id,
        specialtyId: invite.specialtyId,
        created,
      };
    });
  }
}

import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import { recordInitialTermsAcceptance } from '../terms/initial-terms-acceptance';
import type { RequestOrigin } from '../terms/terms-repository';
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

  async createInvite(input: CreateInviteInput): Promise<ProfessionalInviteRecord> {
    // Resolve code->id no catalogo fixo (D-047). Se o code nao existe, a
    // criacao falha aqui (findUniqueOrThrow) — a FK Restrict e a segunda guarda.
    const specialty = await this.db.specialty.findUniqueOrThrow({
      where: { code: input.specialtyCode },
      select: { id: true },
    });
    return this.db.professionalInvite.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        specialtyId: specialty.id,
        councilDocument: input.councilDocument,
        councilState: input.councilState,
        medicalSpecialty: input.medicalSpecialty ?? null,
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

  acceptInvite(
    tokenHash: string,
    account: NewProfessionalAccount,
    origin: RequestOrigin,
  ): Promise<AcceptInviteOutcome> {
    return this.db.$transaction(async (tx) => {
      const invite = await tx.professionalInvite.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          tenantId: true,
          email: true,
          status: true,
          expiresAt: true,
          specialtyId: true,
          councilDocument: true,
          councilState: true,
          medicalSpecialty: true,
        },
      });
      if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
        return { status: 'invalid' };
      }
      // Convite LEGADO (pre-ADR-0015): sem specialtyId nao ha como nascer a
      // ProfessionalSpecialty exigida pelo gate (D-140). Nao existe convite legado
      // real no banco de dev (0 pendentes conferidos) — guarda defensiva.
      if (!invite.specialtyId) {
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

      // A especialidade + conselho (+ medicalSpecialty quando medico) NASCEM do
      // convite (ADR-0015/D-137/D-138), na MESMA transacao do perfil — nunca um
      // profissional de clinica sem especialidade reivindicada. PENDING e o
      // default de verificationStatus (D-010 segue deferido).
      const professionalSpecialty = {
        create: {
          specialty: { connect: { id: invite.specialtyId } },
          councilDocument: invite.councilDocument,
          councilState: invite.councilState,
          medicalSpecialty: invite.medicalSpecialty,
        },
      };

      if (existing) {
        // Conta ja existe (multi-papel — D-041): ja aceitou termos no proprio
        // cadastro; NAO regrava. So cria o perfil + especialidade que faltavam.
        await tx.professionalProfile.create({
          data: {
            accountId: existing.id,
            tenantId: invite.tenantId,
            specialties: professionalSpecialty,
          },
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
          professionalProfile: {
            create: {
              tenant: { connect: { id: invite.tenantId } },
              specialties: professionalSpecialty,
            },
          },
        },
        select: { id: true },
      });
      // Conta NOVA: esta e a porta de nascimento da Account (como o aceite de
      // paciente — D-135) — precisa gravar o consentimento inicial (D-025) na
      // MESMA transacao. Se qualquer parte acima/abaixo falhar, tudo reverte.
      await recordInitialTermsAcceptance(tx, created.id, origin);
      return {
        status: 'accepted',
        tenantId: invite.tenantId,
        accountId: created.id,
        created: true,
      };
    });
  }
}

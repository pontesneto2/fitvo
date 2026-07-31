import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma, setRlsTenantSession } from '@fitvo/database';

import { recordInitialTermsAcceptance } from '../terms/initial-terms-acceptance';
import type { RequestOrigin } from '../terms/terms-repository';
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
  modality: true,
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
        modality: input.modality, // propagada ao Bond no aceite (D-101)
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
        modality: true,
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
      modality: row.modality,
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

  acceptInvite(
    tokenHash: string,
    account: NewPatientAccount,
    origin: RequestOrigin,
  ): Promise<AcceptPatientInviteOutcome> {
    return this.db.$transaction(async (tx) => {
      const invite = await tx.patientInvite.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          tenantId: true,
          professionalProfileId: true,
          specialtyId: true,
          email: true,
          modality: true,
          status: true,
          expiresAt: true,
        },
      });
      if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
        return { status: 'invalid' };
      }

      // Mesmo racional de PrismaInternRepository.acceptInvite: sem ALS aberto
      // (D-150), o RLS (D-152) bloqueia LEITURA e escrita em `bond` sem a sessao
      // setada -- e o `bond.findUnique` de conflito, logo abaixo, ja precisa dela.
      await setRlsTenantSession(tx, invite.tenantId);

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
            socialName: account.socialName ?? null,
            gender: account.gender ?? null,
            // Sexo biologico: NOT NULL com default NOT_INFORMED no banco, mas
            // OBRIGATORIO no contrato do aceite (spec §3.1/§4.6) — o paciente
            // nasce com ele informado, nunca no default.
            biologicalSex: account.biologicalSex,
            document: account.document,
            // Paciente e SEMPRE pessoa fisica (spec §4.6): CPF, sem xor.
            documentType: 'CPF',
            whatsapp: account.whatsapp,
            birthDate: account.birthDate,
            addressStreet: account.address.logradouro,
            addressNumber: account.address.numero,
            addressComplement: account.address.complemento ?? null,
            addressDistrict: account.address.bairro,
            addressCity: account.address.cidade,
            addressState: account.address.state,
            addressZipCode: account.address.cep,
            addressCountry: account.address.country,
            patientProfile: { create: {} },
          },
          select: { id: true, patientProfile: { select: { id: true } } },
        });
        accountId = createdAccount.id;
        patientProfileId = createdAccount.patientProfile!.id;
        created = true;
        // Unico caminho de nascimento de conta de paciente (D-135/ADR-0015):
        // o aceite de convite precisa gravar o consentimento inicial (D-025)
        // que antes vinha do autocadastro removido. Contas existentes (outros
        // dois ramos abaixo) ja aceitaram termos no seu proprio cadastro.
        await recordInitialTermsAcceptance(tx, accountId, origin);
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

      // O vinculo NASCE com a modalidade do convite (D-101): o profissional a
      // escolheu la, e nao ha Bond sem modalidade.
      const bond = await tx.bond.create({
        data: {
          tenantId: invite.tenantId,
          patientProfileId,
          professionalProfileId: invite.professionalProfileId,
          specialtyId: invite.specialtyId,
          modality: invite.modality,
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

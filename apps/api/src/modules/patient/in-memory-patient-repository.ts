import type { BondStatus, CareModality, InviteStatus } from '@fitvo/database';

import type { InMemoryAccountRepository } from '../auth/in-memory-account-repository';
import type { InMemoryTermsRepository } from '../terms/in-memory-terms-repository';
import { recordInitialTermsAcceptanceInMemory } from '../terms/initial-terms-acceptance';
import type { RequestOrigin } from '../terms/terms-repository';
import type {
  AcceptPatientInviteOutcome,
  BondRecord,
  CreatePatientInviteInput,
  NewPatientAccount,
  PatientInviteRecord,
  PatientRepository,
} from './patient-repository';

interface StoredInvite {
  id: string;
  tenantId: string;
  professionalProfileId: string;
  specialtyId: string;
  email: string;
  modality: CareModality;
  status: InviteStatus;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

interface StoredAccount {
  id: string;
  email: string;
  name: string;
  patientProfileId: string | null;
}

interface StoredProfessional {
  id: string;
  accountId: string;
  tenantId: string;
}

interface StoredBond {
  id: string;
  tenantId: string;
  patientProfileId: string;
  professionalProfileId: string;
  specialtyId: string;
  modality: CareModality;
  status: BondStatus;
  createdAt: Date;
  archivedAt: Date | null;
}

export interface SeedProfessionalInput {
  accountId: string;
  tenantId: string;
  /** Especialidades reivindicadas pelo profissional (D-046); tambem registradas no catalogo. */
  specialtyIds?: string[];
}

export interface SeedPatientAccountInput {
  email: string;
  name: string;
  /** Se `true`, a conta ja tem perfil de paciente (cenario de vinculo pre-existente). */
  withPatientProfile?: boolean;
}

/**
 * Implementacao em memoria para testes e desenvolvimento local. Espelha a logica
 * da implementacao Prisma sobre Maps (o loop de eventos single-thread do Node
 * torna cada operacao efetivamente atomica). Os helpers `seed*` arranjam o mundo
 * nos testes — nesta fase o onboarding do profissional/especialidade vem de
 * outras slices, entao aqui semeamos diretamente.
 */
export class InMemoryPatientRepository implements PatientRepository {
  private readonly invites = new Map<string, StoredInvite>();
  private readonly bonds = new Map<string, StoredBond>();
  private readonly accountsById = new Map<string, StoredAccount>();
  private readonly accountIdByEmail = new Map<string, string>();
  private readonly professionals = new Map<string, StoredProfessional>();
  private readonly professionalSpecialties = new Set<string>();
  private readonly specialties = new Set<string>();
  private sequence = 0;

  /**
   * `terms` e `accounts` sao OPCIONAIS — so necessarios nos testes que
   * exercitam o aceite inicial dos termos (D-025) e/ou precisam que a conta
   * criada pelo aceite de convite (D-135/ADR-0015) seja visivel para
   * login/verificacao de e-mail (slice `auth`). Em producao as duas escrevem
   * na MESMA tabela `account`; nos doubles in-memory isso exige repassar a
   * mesma instancia de `InMemoryAccountRepository` usada no harness de teste.
   */
  constructor(
    private readonly terms?: InMemoryTermsRepository,
    private readonly accounts?: InMemoryAccountRepository,
  ) {}

  // --- Seed helpers (testes/dev; fora da interface de producao) ---

  /** Semeia uma especialidade valida no catalogo (D-047). */
  seedSpecialty(specialtyId: string): void {
    this.specialties.add(specialtyId);
  }

  /** Semeia um perfil profissional num tenant + suas especialidades. Retorna o id do perfil. */
  seedProfessional(input: SeedProfessionalInput): string {
    const id = this.nextId('pp');
    this.professionals.set(id, { id, accountId: input.accountId, tenantId: input.tenantId });
    for (const specialtyId of input.specialtyIds ?? []) {
      this.specialties.add(specialtyId);
      this.professionalSpecialties.add(this.specialtyKey(id, specialtyId));
    }
    return id;
  }

  /** Semeia uma conta de paciente existente (cenario multi-papel — D-041). Retorna o id. */
  seedPatientAccount(input: SeedPatientAccountInput): string {
    const id = this.nextId('acc');
    const patientProfileId = input.withPatientProfile ? this.nextId('patp') : null;
    this.accountsById.set(id, { id, email: input.email, name: input.name, patientProfileId });
    this.accountIdByEmail.set(input.email, id);
    return id;
  }

  // --- PatientRepository ---

  findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null> {
    for (const professional of this.professionals.values()) {
      if (professional.accountId === accountId && professional.tenantId === tenantId) {
        return Promise.resolve({ professionalProfileId: professional.id });
      }
    }
    return Promise.resolve(null);
  }

  specialtyExists(specialtyId: string): Promise<boolean> {
    return Promise.resolve(this.specialties.has(specialtyId));
  }

  professionalHasSpecialty(professionalProfileId: string, specialtyId: string): Promise<boolean> {
    return Promise.resolve(
      this.professionalSpecialties.has(this.specialtyKey(professionalProfileId, specialtyId)),
    );
  }

  createInvite(input: CreatePatientInviteInput): Promise<PatientInviteRecord> {
    const invite: StoredInvite = {
      id: this.nextId('pinv'),
      tenantId: input.tenantId,
      professionalProfileId: input.professionalProfileId,
      specialtyId: input.specialtyId,
      email: input.email,
      modality: input.modality,
      status: 'PENDING',
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    };
    this.invites.set(invite.id, invite);
    return Promise.resolve(this.toInviteRecord(invite));
  }

  findPendingInvite(
    tenantId: string,
    professionalProfileId: string,
    email: string,
    specialtyId: string,
  ): Promise<PatientInviteRecord | null> {
    for (const invite of this.invites.values()) {
      if (
        invite.tenantId === tenantId &&
        invite.professionalProfileId === professionalProfileId &&
        invite.email === email &&
        invite.specialtyId === specialtyId &&
        invite.status === 'PENDING'
      ) {
        return Promise.resolve(this.toInviteRecord(invite));
      }
    }
    return Promise.resolve(null);
  }

  listPendingInvites(
    tenantId: string,
    professionalProfileId: string,
  ): Promise<PatientInviteRecord[]> {
    const rows = [...this.invites.values()]
      .filter(
        (invite) =>
          invite.tenantId === tenantId &&
          invite.professionalProfileId === professionalProfileId &&
          invite.status === 'PENDING',
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((invite) => this.toInviteRecord(invite));
    return Promise.resolve(rows);
  }

  listActiveBonds(tenantId: string, professionalProfileId: string): Promise<BondRecord[]> {
    const rows = [...this.bonds.values()]
      .filter(
        (bond) =>
          bond.tenantId === tenantId &&
          bond.professionalProfileId === professionalProfileId &&
          bond.status === 'ACTIVE',
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((bond) => this.toBondRecord(bond));
    return Promise.resolve(rows);
  }

  resendInvite(
    tenantId: string,
    professionalProfileId: string,
    inviteId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<PatientInviteRecord | null> {
    const invite = this.invites.get(inviteId);
    if (
      !invite ||
      invite.tenantId !== tenantId ||
      invite.professionalProfileId !== professionalProfileId ||
      invite.status !== 'PENDING'
    ) {
      return Promise.resolve(null);
    }
    invite.tokenHash = tokenHash;
    invite.expiresAt = expiresAt;
    return Promise.resolve(this.toInviteRecord(invite));
  }

  revokeInvite(
    tenantId: string,
    professionalProfileId: string,
    inviteId: string,
  ): Promise<boolean> {
    const invite = this.invites.get(inviteId);
    if (
      !invite ||
      invite.tenantId !== tenantId ||
      invite.professionalProfileId !== professionalProfileId ||
      invite.status !== 'PENDING'
    ) {
      return Promise.resolve(false);
    }
    invite.status = 'REVOKED';
    return Promise.resolve(true);
  }

  archiveBond(tenantId: string, professionalProfileId: string, bondId: string): Promise<boolean> {
    const bond = this.bonds.get(bondId);
    if (
      !bond ||
      bond.tenantId !== tenantId ||
      bond.professionalProfileId !== professionalProfileId ||
      bond.status !== 'ACTIVE'
    ) {
      return Promise.resolve(false);
    }
    bond.status = 'ARCHIVED';
    bond.archivedAt = new Date();
    return Promise.resolve(true);
  }

  async acceptInvite(
    tokenHash: string,
    account: NewPatientAccount,
    origin: RequestOrigin,
  ): Promise<AcceptPatientInviteOutcome> {
    const invite = this.findByTokenHash(tokenHash);
    if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
      return { status: 'invalid' };
    }

    const existingId = this.accountIdByEmail.get(invite.email);
    const existing = existingId ? this.accountsById.get(existingId) : undefined;

    if (existing?.patientProfileId && this.bondExists(existing.patientProfileId, invite)) {
      return { status: 'bond-conflict' };
    }

    invite.status = 'ACCEPTED';

    let accountId: string;
    let patientProfileId: string;
    let created: boolean;

    if (!existing) {
      // Se `accounts` foi injetado, a conta nasce LA (mesma tabela unica que o
      // Prisma usa em producao) — assim login/verificacao de e-mail (slice
      // `auth`) enxergam esta conta nos testes. Sem `accounts` (harness que nao
      // precisa disso), mantem o id local de sempre.
      const seeded = this.accounts
        ? await this.accounts.seedAccount(invite.email, account.passwordHash, account.name)
        : null;
      const stored: StoredAccount = {
        id: seeded?.id ?? this.nextId('acc'),
        email: invite.email,
        name: account.name,
        patientProfileId: this.nextId('patp'),
      };
      this.accountsById.set(stored.id, stored);
      this.accountIdByEmail.set(invite.email, stored.id);
      accountId = stored.id;
      patientProfileId = stored.patientProfileId!;
      created = true;
      // Unico caminho de nascimento de conta de paciente (D-135/ADR-0015): ver
      // `PrismaPatientRepository.acceptInvite` (mesma regra, D-025).
      if (this.terms) {
        await recordInitialTermsAcceptanceInMemory(this.terms, accountId, origin);
      }
    } else if (existing.patientProfileId) {
      accountId = existing.id;
      patientProfileId = existing.patientProfileId;
      created = false;
    } else {
      existing.patientProfileId = this.nextId('patp');
      accountId = existing.id;
      patientProfileId = existing.patientProfileId;
      created = false;
    }

    // Espelha o Prisma: o vinculo nasce com a modalidade do convite (D-101).
    const bond: StoredBond = {
      id: this.nextId('bond'),
      tenantId: invite.tenantId,
      patientProfileId,
      professionalProfileId: invite.professionalProfileId,
      specialtyId: invite.specialtyId,
      modality: invite.modality,
      status: 'ACTIVE',
      createdAt: new Date(),
      archivedAt: null,
    };
    this.bonds.set(bond.id, bond);

    return Promise.resolve({
      status: 'accepted',
      tenantId: invite.tenantId,
      accountId,
      patientProfileId,
      professionalProfileId: invite.professionalProfileId,
      bondId: bond.id,
      specialtyId: invite.specialtyId,
      created,
    });
  }

  // --- helpers privados ---

  private bondExists(patientProfileId: string, invite: StoredInvite): boolean {
    for (const bond of this.bonds.values()) {
      if (
        bond.patientProfileId === patientProfileId &&
        bond.professionalProfileId === invite.professionalProfileId &&
        bond.specialtyId === invite.specialtyId
      ) {
        return true;
      }
    }
    return false;
  }

  private findByTokenHash(tokenHash: string): StoredInvite | undefined {
    for (const invite of this.invites.values()) {
      if (invite.tokenHash === tokenHash) {
        return invite;
      }
    }
    return undefined;
  }

  private toInviteRecord(invite: StoredInvite): PatientInviteRecord {
    return {
      id: invite.id,
      tenantId: invite.tenantId,
      professionalProfileId: invite.professionalProfileId,
      specialtyId: invite.specialtyId,
      email: invite.email,
      modality: invite.modality,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    };
  }

  private toBondRecord(bond: StoredBond): BondRecord {
    const account = this.accountForPatientProfile(bond.patientProfileId);
    return {
      id: bond.id,
      patientProfileId: bond.patientProfileId,
      patientName: account?.name ?? '',
      patientEmail: account?.email ?? '',
      specialtyId: bond.specialtyId,
      modality: bond.modality,
      status: bond.status,
      createdAt: bond.createdAt,
      archivedAt: bond.archivedAt,
    };
  }

  private accountForPatientProfile(patientProfileId: string): StoredAccount | undefined {
    for (const account of this.accountsById.values()) {
      if (account.patientProfileId === patientProfileId) {
        return account;
      }
    }
    return undefined;
  }

  private specialtyKey(professionalProfileId: string, specialtyId: string): string {
    return `${professionalProfileId}:${specialtyId}`;
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }
}

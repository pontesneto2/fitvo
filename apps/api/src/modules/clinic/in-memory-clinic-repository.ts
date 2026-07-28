import type { BrazilianState, ClinicRole, InviteStatus, MedicalSpecialty } from '@fitvo/database';

import type { SpecialtyRepository } from '../specialty/specialty-repository';
import { recordInitialTermsAcceptanceInMemory } from '../terms/initial-terms-acceptance';
import type { RequestOrigin, TermsRepository } from '../terms/terms-repository';
import type {
  AcceptInviteOutcome,
  ClinicProfessionalRecord,
  ClinicRepository,
  CreateInviteInput,
  NewProfessionalAccount,
  ProfessionalInviteRecord,
} from './clinic-repository';

interface StoredInvite {
  id: string;
  tenantId: string;
  email: string;
  status: InviteStatus;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  /** Espelha o convite migrado (ADR-0015): especialidade + conselho fixados no convite. */
  specialtyId: string | null;
  councilDocument: string | null;
  councilState: BrazilianState | null;
  medicalSpecialty: MedicalSpecialty | null;
}

interface StoredAccount {
  id: string;
  email: string;
  name: string;
  professionalProfileId: string | null;
}

interface StoredProfile {
  id: string;
  accountId: string;
  tenantId: string;
  displayName: string | null;
  createdAt: Date;
}

/** ProfessionalSpecialty espelhada (ADR-0015) — para asserts nos testes. */
export interface StoredProfessionalSpecialty {
  professionalProfileId: string;
  specialtyId: string;
  councilDocument: string | null;
  councilState: BrazilianState | null;
  medicalSpecialty: MedicalSpecialty | null;
  verificationStatus: 'PENDING';
}

export interface SeedAccountInput {
  email: string;
  name: string;
}

/**
 * Implementacao em memoria para testes e desenvolvimento local. Espelha a
 * logica da implementacao Prisma sobre Maps (o loop de eventos single-thread do
 * Node torna cada operacao efetivamente atomica). Recebe o repositorio de termos
 * (como o de account/patient) para gravar o aceite INICIAL (D-025) SO quando a
 * conta e nova, e o catalogo de especialidades (D-047) para resolver code->id no
 * convite. Os helpers `seed*` arranjam o mundo nos testes.
 */
export class InMemoryClinicRepository implements ClinicRepository {
  private readonly invites = new Map<string, StoredInvite>();
  private readonly accountsById = new Map<string, StoredAccount>();
  private readonly accountIdByEmail = new Map<string, string>();
  private readonly profiles = new Map<string, StoredProfile>();
  private readonly memberships = new Map<string, ClinicRole>();
  private readonly professionalSpecialties: StoredProfessionalSpecialty[] = [];
  private sequence = 0;

  constructor(
    private readonly terms: TermsRepository,
    private readonly specialties: SpecialtyRepository,
  ) {}

  // --- Seed helpers (testes/dev; fora da interface de producao) ---

  /** Semeia um admin de clinica para uma conta ja existente na slice de auth. */
  seedAdmin(accountId: string, tenantId: string, role: ClinicRole = 'CLINIC_ADMIN'): void {
    this.memberships.set(this.membershipKey(accountId, tenantId), role);
  }

  /** Semeia uma conta existente SEM perfil profissional (cenario multi-papel — D-041). */
  seedAccount(input: SeedAccountInput): string {
    const id = this.nextId('acc');
    this.accountsById.set(id, {
      id,
      email: input.email,
      name: input.name,
      professionalProfileId: null,
    });
    this.accountIdByEmail.set(input.email, id);
    return id;
  }

  /** Leitura das ProfessionalSpecialty criadas — para asserts nos testes. */
  listProfessionalSpecialties(professionalProfileId?: string): StoredProfessionalSpecialty[] {
    return this.professionalSpecialties.filter(
      (s) =>
        professionalProfileId === undefined || s.professionalProfileId === professionalProfileId,
    );
  }

  // --- ClinicRepository ---

  findMembership(accountId: string, tenantId: string): Promise<{ role: ClinicRole } | null> {
    const role = this.memberships.get(this.membershipKey(accountId, tenantId));
    return Promise.resolve(role ? { role } : null);
  }

  async createInvite(input: CreateInviteInput): Promise<ProfessionalInviteRecord> {
    const specialtyId = await this.resolveSpecialtyId(input.specialtyCode);
    const invite: StoredInvite = {
      id: this.nextId('inv'),
      tenantId: input.tenantId,
      email: input.email,
      status: 'PENDING',
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      specialtyId,
      councilDocument: input.councilDocument,
      councilState: input.councilState,
      medicalSpecialty: input.medicalSpecialty ?? null,
    };
    this.invites.set(invite.id, invite);
    return this.toInviteRecord(invite);
  }

  findPendingInviteByEmail(
    tenantId: string,
    email: string,
  ): Promise<ProfessionalInviteRecord | null> {
    for (const invite of this.invites.values()) {
      if (invite.tenantId === tenantId && invite.email === email && invite.status === 'PENDING') {
        return Promise.resolve(this.toInviteRecord(invite));
      }
    }
    return Promise.resolve(null);
  }

  listPendingInvites(tenantId: string): Promise<ProfessionalInviteRecord[]> {
    const rows = [...this.invites.values()]
      .filter((invite) => invite.tenantId === tenantId && invite.status === 'PENDING')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((invite) => this.toInviteRecord(invite));
    return Promise.resolve(rows);
  }

  listProfessionals(tenantId: string): Promise<ClinicProfessionalRecord[]> {
    const rows = [...this.profiles.values()]
      .filter((profile) => profile.tenantId === tenantId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((profile) => {
        const account = this.accountsById.get(profile.accountId);
        return {
          professionalProfileId: profile.id,
          accountId: profile.accountId,
          name: account?.name ?? '',
          email: account?.email ?? '',
          displayName: profile.displayName,
          joinedAt: profile.createdAt,
        };
      });
    return Promise.resolve(rows);
  }

  revokeInvite(tenantId: string, inviteId: string): Promise<boolean> {
    const invite = this.invites.get(inviteId);
    if (!invite || invite.tenantId !== tenantId || invite.status !== 'PENDING') {
      return Promise.resolve(false);
    }
    invite.status = 'REVOKED';
    return Promise.resolve(true);
  }

  async acceptInvite(
    tokenHash: string,
    account: NewProfessionalAccount,
    origin: RequestOrigin,
  ): Promise<AcceptInviteOutcome> {
    const invite = this.findByTokenHash(tokenHash);
    if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
      return { status: 'invalid' };
    }
    // Convite LEGADO (pre-ADR-0015): sem specialtyId -> invalido (guarda defensiva).
    if (!invite.specialtyId) {
      return { status: 'invalid' };
    }

    const existingId = this.accountIdByEmail.get(invite.email);
    const existing = existingId ? this.accountsById.get(existingId) : undefined;
    if (existing?.professionalProfileId) {
      return { status: 'conflict' };
    }

    invite.status = 'ACCEPTED';
    if (existing) {
      // Conta ja existe (multi-papel — D-041): NAO regrava termos.
      const profileId = this.attachProfile(existing.id, invite.tenantId);
      this.attachSpecialty(profileId, invite);
      existing.professionalProfileId = profileId;
      return {
        status: 'accepted',
        tenantId: invite.tenantId,
        accountId: existing.id,
        created: false,
      };
    }

    const stored: StoredAccount = {
      id: this.nextId('acc'),
      email: invite.email,
      name: account.name,
      professionalProfileId: null,
    };
    this.accountsById.set(stored.id, stored);
    this.accountIdByEmail.set(invite.email, stored.id);
    const profileId = this.attachProfile(stored.id, invite.tenantId);
    this.attachSpecialty(profileId, invite);
    stored.professionalProfileId = profileId;
    // Conta NOVA: grava o aceite inicial dos termos (D-025), como o aceite de
    // paciente/o cadastro de auth. Mesma regra que a Prisma.
    await recordInitialTermsAcceptanceInMemory(this.terms, stored.id, origin);
    return {
      status: 'accepted',
      tenantId: invite.tenantId,
      accountId: stored.id,
      created: true,
    };
  }

  // --- helpers privados ---

  private async resolveSpecialtyId(code: CreateInviteInput['specialtyCode']): Promise<string> {
    const catalog = await this.specialties.list();
    const found = catalog.find((s) => s.code === code);
    if (!found) {
      throw new Error(`Especialidade ${code} inexistente no catalogo (D-047).`);
    }
    return found.id;
  }

  private attachProfile(accountId: string, tenantId: string): string {
    const profile: StoredProfile = {
      id: this.nextId('pp'),
      accountId,
      tenantId,
      displayName: null,
      createdAt: new Date(),
    };
    this.profiles.set(profile.id, profile);
    return profile.id;
  }

  private attachSpecialty(professionalProfileId: string, invite: StoredInvite): void {
    this.professionalSpecialties.push({
      professionalProfileId,
      specialtyId: invite.specialtyId!,
      councilDocument: invite.councilDocument,
      councilState: invite.councilState,
      medicalSpecialty: invite.medicalSpecialty,
      verificationStatus: 'PENDING',
    });
  }

  private findByTokenHash(tokenHash: string): StoredInvite | undefined {
    for (const invite of this.invites.values()) {
      if (invite.tokenHash === tokenHash) {
        return invite;
      }
    }
    return undefined;
  }

  private toInviteRecord(invite: StoredInvite): ProfessionalInviteRecord {
    return {
      id: invite.id,
      tenantId: invite.tenantId,
      email: invite.email,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    };
  }

  private membershipKey(accountId: string, tenantId: string): string {
    return `${accountId}:${tenantId}`;
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }
}

import type { BrazilianState, InviteStatus, SpecialtyCode } from '@fitvo/database';

import { recordInitialTermsAcceptanceInMemory } from '../terms/initial-terms-acceptance';
import type { RequestOrigin, TermsRepository } from '../terms/terms-repository';
import type {
  AcceptInternInviteOutcome,
  CreateInternInviteInput,
  InternInviteRecord,
  InternRepository,
  InternSupervisorRecord,
  NewInternAccount,
} from './intern-repository';

interface StoredInvite {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  status: InviteStatus;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  /** NUNCA nulo — espelha o NOT NULL da coluna (D-142). */
  supervisorProfessionalProfileId: string;
}

interface StoredSupervisor extends InternSupervisorRecord {
  tenantId: string;
}

/** Seat de estagiario espelhado — para asserts nos testes. */
export interface StoredInternProfile {
  id: string;
  accountId: string;
  tenantId: string;
  supervisorProfessionalProfileId: string;
}

export interface SeedSupervisorInput {
  tenantId: string;
  accountId?: string;
  displayName?: string;
  /** Conselho do responsavel. CREF por padrao — o unico elegivel (D-142). */
  specialtyCode?: SpecialtyCode;
  councilDocument?: string;
  councilState?: BrazilianState;
}

/**
 * Implementacao em memoria para testes e desenvolvimento local. Espelha a logica
 * da implementacao Prisma sobre Maps (o loop single-thread do Node torna cada
 * operacao efetivamente atomica). Recebe o repositorio de termos para gravar o
 * aceite INICIAL (D-025) SO quando a conta e nova — mesma regra da Prisma.
 *
 * O que este double NAO consegue provar e justamente o que a integracao contra
 * Postgres real prova: que a FK NOT NULL do responsavel e o rollback da
 * transacao valem no banco. Aqui a garantia e do TIPO
 * (`supervisorProfessionalProfileId: string`, nao opcional); la e do schema.
 */
export class InMemoryInternRepository implements InternRepository {
  private readonly invites = new Map<string, StoredInvite>();
  private readonly supervisors = new Map<string, StoredSupervisor>();
  private readonly internProfiles = new Map<string, StoredInternProfile>();
  private readonly internProfileIdByAccountId = new Map<string, string>();
  private readonly accountIdByEmail = new Map<string, string>();
  private sequence = 0;

  constructor(private readonly terms: TermsRepository) {}

  // --- Seed helpers (testes/dev; fora da interface de producao) ---

  /** Semeia um responsavel ELEGIVEL (CREF) no tenant. Devolve o professionalProfileId. */
  seedSupervisor(input: SeedSupervisorInput): string {
    const professionalProfileId = this.nextId('pp');
    this.supervisors.set(professionalProfileId, {
      professionalProfileId,
      tenantId: input.tenantId,
      accountId: input.accountId ?? this.nextId('acc'),
      displayName: input.displayName ?? 'Professor CREF',
      specialtyCode: input.specialtyCode ?? 'TRAINING',
      councilDocument: input.councilDocument ?? 'CREF-123456',
      councilState: input.councilState ?? 'SP',
    });
    return professionalProfileId;
  }

  /** Semeia uma conta ja existente (cenario multi-papel — D-041). */
  seedAccount(email: string, accountId: string): void {
    this.accountIdByEmail.set(email, accountId);
  }

  /** Leitura dos seats criados — para asserts nos testes. */
  listInternProfiles(tenantId?: string): StoredInternProfile[] {
    return [...this.internProfiles.values()].filter(
      (profile) => tenantId === undefined || profile.tenantId === tenantId,
    );
  }

  // --- InternRepository ---

  listEligibleSupervisors(tenantId: string): Promise<InternSupervisorRecord[]> {
    const rows = [...this.supervisors.values()]
      .filter((s) => s.tenantId === tenantId)
      .map(({ tenantId: _tenantId, ...view }) => view);
    return Promise.resolve(rows);
  }

  isEligibleSupervisor(tenantId: string, professionalProfileId: string): Promise<boolean> {
    const supervisor = this.supervisors.get(professionalProfileId);
    return Promise.resolve(supervisor?.tenantId === tenantId);
  }

  createInvite(input: CreateInternInviteInput): Promise<InternInviteRecord> {
    const invite: StoredInvite = {
      id: this.nextId('iinv'),
      tenantId: input.tenantId,
      email: input.email,
      name: input.name ?? null,
      status: 'PENDING',
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      supervisorProfessionalProfileId: input.supervisorProfessionalProfileId,
    };
    this.invites.set(invite.id, invite);
    return Promise.resolve({ ...invite });
  }

  findPendingInviteByEmail(tenantId: string, email: string): Promise<InternInviteRecord | null> {
    for (const invite of this.invites.values()) {
      if (invite.tenantId === tenantId && invite.email === email && invite.status === 'PENDING') {
        return Promise.resolve({ ...invite });
      }
    }
    return Promise.resolve(null);
  }

  async acceptInvite(
    tokenHash: string,
    // Identidade da pessoa: este double nao espelha as colunas da `Account` (o
    // que ele modela e o SEAT e o vinculo). A propagacao dos campos de pessoa e
    // provada na integracao contra Postgres real.
    _account: NewInternAccount,
    origin: RequestOrigin,
  ): Promise<AcceptInternInviteOutcome> {
    const invite = this.findByTokenHash(tokenHash);
    if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
      return { status: 'invalid' };
    }

    const existingId = this.accountIdByEmail.get(invite.email);
    if (existingId && this.internProfileIdByAccountId.has(existingId)) {
      return { status: 'conflict' };
    }

    invite.status = 'ACCEPTED';

    if (existingId) {
      // Conta ja existe (multi-papel — D-041): NAO regrava termos.
      this.attachInternProfile(existingId, invite);
      return {
        status: 'accepted',
        tenantId: invite.tenantId,
        accountId: existingId,
        supervisorProfessionalProfileId: invite.supervisorProfessionalProfileId,
        created: false,
      };
    }

    const accountId = this.nextId('acc');
    this.accountIdByEmail.set(invite.email, accountId);
    this.attachInternProfile(accountId, invite);
    // Conta NOVA: grava o aceite inicial dos termos (D-025). Mesma regra da Prisma.
    await recordInitialTermsAcceptanceInMemory(this.terms, accountId, origin);
    return {
      status: 'accepted',
      tenantId: invite.tenantId,
      accountId,
      supervisorProfessionalProfileId: invite.supervisorProfessionalProfileId,
      created: true,
    };
  }

  // --- helpers privados ---

  private attachInternProfile(accountId: string, invite: StoredInvite): void {
    const profile: StoredInternProfile = {
      id: this.nextId('ip'),
      accountId,
      tenantId: invite.tenantId,
      supervisorProfessionalProfileId: invite.supervisorProfessionalProfileId,
    };
    this.internProfiles.set(profile.id, profile);
    this.internProfileIdByAccountId.set(accountId, profile.id);
  }

  private findByTokenHash(tokenHash: string): StoredInvite | undefined {
    for (const invite of this.invites.values()) {
      if (invite.tokenHash === tokenHash) {
        return invite;
      }
    }
    return undefined;
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }
}

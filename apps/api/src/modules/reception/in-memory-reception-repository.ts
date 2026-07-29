import type { InviteStatus } from '@fitvo/database';

import { recordInitialTermsAcceptanceInMemory } from '../terms/initial-terms-acceptance';
import type { RequestOrigin, TermsRepository } from '../terms/terms-repository';
import type {
  AcceptReceptionInviteOutcome,
  CreateReceptionInviteInput,
  NewReceptionAccount,
  ReceptionInviteRecord,
  ReceptionRepository,
} from './reception-repository';

interface StoredInvite {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  status: InviteStatus;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Seat de recepcao espelhado — para asserts nos testes. */
export interface StoredReceptionProfile {
  id: string;
  accountId: string;
  tenantId: string;
}

/**
 * Implementacao em memoria para testes e desenvolvimento local. Espelha a logica
 * da implementacao Prisma sobre Maps (o loop single-thread do Node torna cada
 * operacao efetivamente atomica). Recebe o repositorio de termos para gravar o
 * aceite INICIAL (D-025) SO quando a conta e nova — mesma regra da Prisma.
 *
 * O que este double NAO consegue provar e justamente o que a integracao contra
 * Postgres real prova: que o `@unique` do accountId e o rollback da transacao
 * valem no banco.
 */
export class InMemoryReceptionRepository implements ReceptionRepository {
  private readonly invites = new Map<string, StoredInvite>();
  private readonly receptionProfiles = new Map<string, StoredReceptionProfile>();
  private readonly receptionProfileIdByAccountId = new Map<string, string>();
  private readonly accountIdByEmail = new Map<string, string>();
  private sequence = 0;

  constructor(private readonly terms: TermsRepository) {}

  // --- Seed helpers (testes/dev; fora da interface de producao) ---

  /** Semeia uma conta ja existente (cenario multi-papel — D-041). */
  seedAccount(email: string, accountId: string): void {
    this.accountIdByEmail.set(email, accountId);
  }

  /** Leitura dos seats criados — para asserts nos testes. */
  listReceptionProfiles(tenantId?: string): StoredReceptionProfile[] {
    return [...this.receptionProfiles.values()].filter(
      (profile) => tenantId === undefined || profile.tenantId === tenantId,
    );
  }

  // --- ReceptionRepository ---

  createInvite(input: CreateReceptionInviteInput): Promise<ReceptionInviteRecord> {
    const invite: StoredInvite = {
      id: this.nextId('rinv'),
      tenantId: input.tenantId,
      email: input.email,
      name: input.name ?? null,
      status: 'PENDING',
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    };
    this.invites.set(invite.id, invite);
    return Promise.resolve({ ...invite });
  }

  findPendingInviteByEmail(tenantId: string, email: string): Promise<ReceptionInviteRecord | null> {
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
    _account: NewReceptionAccount,
    origin: RequestOrigin,
  ): Promise<AcceptReceptionInviteOutcome> {
    const invite = this.findByTokenHash(tokenHash);
    if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
      return { status: 'invalid' };
    }

    const existingId = this.accountIdByEmail.get(invite.email);
    if (existingId && this.receptionProfileIdByAccountId.has(existingId)) {
      return { status: 'conflict' };
    }

    invite.status = 'ACCEPTED';

    if (existingId) {
      // Conta ja existe (multi-papel — D-041): NAO regrava termos.
      this.attachReceptionProfile(existingId, invite);
      return {
        status: 'accepted',
        tenantId: invite.tenantId,
        accountId: existingId,
        created: false,
      };
    }

    const accountId = this.nextId('acc');
    this.accountIdByEmail.set(invite.email, accountId);
    this.attachReceptionProfile(accountId, invite);
    // Conta NOVA: grava o aceite inicial dos termos (D-025). Mesma regra da Prisma.
    await recordInitialTermsAcceptanceInMemory(this.terms, accountId, origin);
    return { status: 'accepted', tenantId: invite.tenantId, accountId, created: true };
  }

  // --- helpers privados ---

  private attachReceptionProfile(accountId: string, invite: StoredInvite): void {
    const profile: StoredReceptionProfile = {
      id: this.nextId('rp'),
      accountId,
      tenantId: invite.tenantId,
    };
    this.receptionProfiles.set(profile.id, profile);
    this.receptionProfileIdByAccountId.set(accountId, profile.id);
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

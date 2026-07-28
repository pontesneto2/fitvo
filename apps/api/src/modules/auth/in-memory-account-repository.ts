import type { BrazilianState, VerificationStatus } from '@fitvo/database';

import type { InMemoryTermsRepository } from '../terms/in-memory-terms-repository';
import { recordInitialTermsAcceptanceInMemory } from '../terms/initial-terms-acceptance';
import type {
  AccountRecord,
  AccountRepository,
  CreateProfessionalInput,
  TermsAcceptanceOrigin,
} from './account-repository';

/** Projecao minima da ProfessionalSpecialty criada no cadastro (D-137) — so para asserts de teste. */
export interface InMemoryProfessionalSpecialtyRecord {
  specialtyId: string;
  councilDocument: string;
  councilState: BrazilianState;
  verificationStatus: VerificationStatus;
}

/**
 * Implementacao em memoria para testes e desenvolvimento local. Recebe
 * OPCIONALMENTE o repositorio de termos em memoria para espelhar, nos testes,
 * a mesma atomicidade de app+eventos ACCEPTED que a `PrismaAccountRepository`
 * faz numa unica transacao (D-025) — a mesma instancia deve ser passada ao
 * `TermsApplicationService` no harness de teste.
 */
export class InMemoryAccountRepository implements AccountRepository {
  private readonly byId = new Map<string, AccountRecord>();
  private readonly emailToId = new Map<string, string>();
  private readonly professionalSpecialtiesByAccountId = new Map<
    string,
    InMemoryProfessionalSpecialtyRecord
  >();
  private sequence = 0;

  constructor(private readonly terms?: InMemoryTermsRepository) {}

  findByEmail(email: string): Promise<AccountRecord | null> {
    const id = this.emailToId.get(email);
    return Promise.resolve((id && this.byId.get(id)) || null);
  }

  findById(id: string): Promise<AccountRecord | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  async createProfessional(input: CreateProfessionalInput): Promise<AccountRecord> {
    const account = await this.insert(
      input.email,
      input.passwordHash,
      input.name,
      input.socialName ?? null,
    );
    this.professionalSpecialtiesByAccountId.set(account.id, {
      specialtyId: input.specialtyId,
      councilDocument: input.councilDocument,
      councilState: input.councilState,
      verificationStatus: 'PENDING',
    });
    await this.recordInitialTermsAcceptance(account.id, input.termsAcceptance);
    return account;
  }

  /** Helper de teste: a ProfessionalSpecialty criada no cadastro (D-137), se houver. */
  getProfessionalSpecialty(accountId: string): InMemoryProfessionalSpecialtyRecord | null {
    return this.professionalSpecialtiesByAccountId.get(accountId) ?? null;
  }

  /**
   * Seed de teste (fora da interface `AccountRepository` de producao): registra
   * uma conta criada por OUTRO modulo — o aceite de convite de paciente
   * (`InMemoryPatientRepository`, D-135/ADR-0015). Espelha a unica tabela
   * `account` do Postgres: em producao os dois caminhos escrevem na mesma
   * tabela; nos doubles in-memory (Maps separados por modulo), sem isto o
   * login/verificacao de e-mail (slice `auth`) nunca enxergariam a conta.
   */
  seedAccount(email: string, passwordHash: string, name: string): Promise<AccountRecord> {
    return this.insert(email, passwordHash, name, null);
  }

  markEmailVerified(id: string): Promise<void> {
    const account = this.byId.get(id);
    if (account) {
      account.emailVerifiedAt = new Date();
    }
    return Promise.resolve();
  }

  updatePassword(id: string, passwordHash: string): Promise<void> {
    const account = this.byId.get(id);
    if (account) {
      account.passwordHash = passwordHash;
    }
    return Promise.resolve();
  }

  /** Ver `recordInitialTermsAcceptance` (`../terms/initial-terms-acceptance`, mesma regra). */
  private async recordInitialTermsAcceptance(
    accountId: string,
    origin: TermsAcceptanceOrigin,
  ): Promise<void> {
    if (!this.terms) {
      return;
    }
    await recordInitialTermsAcceptanceInMemory(this.terms, accountId, origin);
  }

  private insert(
    email: string,
    passwordHash: string,
    name: string,
    socialName: string | null,
  ): Promise<AccountRecord> {
    this.sequence += 1;
    const account: AccountRecord = {
      id: `acc_${this.sequence}`,
      email,
      passwordHash,
      name,
      socialName,
      emailVerifiedAt: null,
    };
    this.byId.set(account.id, account);
    this.emailToId.set(email, account.id);
    return Promise.resolve(account);
  }
}

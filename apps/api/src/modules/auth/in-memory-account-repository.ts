import type { TermsDocumentSlug } from '@fitvo/database';

import type { InMemoryTermsRepository } from '../terms/in-memory-terms-repository';
import type {
  AccountRecord,
  AccountRepository,
  CreatePatientInput,
  CreateProfessionalInput,
  TermsAcceptanceOrigin,
} from './account-repository';

/** Documentos com aceite obrigatorio no cadastro (D-025) — espelha o Prisma. */
const REQUIRED_TERMS_DOCUMENTS: TermsDocumentSlug[] = ['TERMS_OF_USE', 'PRIVACY_POLICY'];

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
    const account = await this.insert(input.email, input.passwordHash, input.name);
    await this.recordInitialTermsAcceptance(account.id, input.termsAcceptance);
    return account;
  }

  async createPatient(input: CreatePatientInput): Promise<AccountRecord> {
    const account = await this.insert(input.email, input.passwordHash, input.name);
    await this.recordInitialTermsAcceptance(account.id, input.termsAcceptance);
    return account;
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

  /** Ver `PrismaAccountRepository.recordInitialTermsAcceptance` (mesma regra). */
  private async recordInitialTermsAcceptance(
    accountId: string,
    origin: TermsAcceptanceOrigin,
  ): Promise<void> {
    if (!this.terms) {
      return;
    }
    for (const slug of REQUIRED_TERMS_DOCUMENTS) {
      const currentVersion = await this.terms.findCurrentVersion(slug);
      if (!currentVersion) {
        throw new Error(
          `Nenhuma versao publicada para o documento de termos ${slug} — catalogo nao semeado.`,
        );
      }
      await this.terms.recordAcceptance({
        accountId,
        termsVersionId: currentVersion.id,
        ipAddress: origin.ipAddress,
        userAgent: origin.userAgent,
      });
    }
  }

  private insert(email: string, passwordHash: string, name: string): Promise<AccountRecord> {
    this.sequence += 1;
    const account: AccountRecord = {
      id: `acc_${this.sequence}`,
      email,
      passwordHash,
      name,
      emailVerifiedAt: null,
    };
    this.byId.set(account.id, account);
    this.emailToId.set(email, account.id);
    return Promise.resolve(account);
  }
}

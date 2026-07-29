import type { BrazilianState, VerificationStatus } from '@fitvo/database';

import type { InMemoryTermsRepository } from '../terms/in-memory-terms-repository';
import { recordInitialTermsAcceptanceInMemory } from '../terms/initial-terms-acceptance';
import type {
  AccountRecord,
  AccountRepository,
  AccountWithProfileRecord,
  CompleteProfileInput,
  CreateCompanyInput,
  CreateProfessionalInput,
  ProfileCompletenessFields,
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
  private readonly byId = new Map<string, AccountWithProfileRecord>();
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

  findByIdWithProfile(id: string): Promise<AccountWithProfileRecord | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }

  /** Espelha a Prisma: `undefined` = nao mexer (nao zera o que ja existe). */
  completeProfile(id: string, input: CompleteProfileInput): Promise<AccountWithProfileRecord> {
    const account = this.byId.get(id);
    if (!account) {
      throw new Error(`Conta ${id} nao encontrada.`);
    }
    const updated: AccountWithProfileRecord = {
      ...account,
      ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
      ...(input.birthDate !== undefined ? { birthDate: input.birthDate } : {}),
    };
    this.byId.set(id, updated);
    return Promise.resolve(updated);
  }

  async createProfessional(input: CreateProfessionalInput): Promise<AccountRecord> {
    // Autonomo coleta os tres (spec §4.1) — nasce COMPLETO, nunca ve o gate.
    const account = await this.insert(
      input.email,
      input.passwordHash,
      input.name,
      input.socialName ?? null,
      { birthDate: input.birthDate, whatsapp: input.whatsapp },
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

  async createCompany(input: CreateCompanyInput): Promise<AccountRecord> {
    // O admin da empresa informa nascimento e WhatsApp, mas NAO endereco
    // pessoal: o endereco do cadastro e do ESTABELECIMENTO (spec §4.2, item 6)
    // e vai para o Tenant, nao para a Account. Espelha a Prisma exatamente.
    const account = await this.insert(
      input.admin.email,
      input.admin.passwordHash,
      input.admin.name,
      input.admin.socialName ?? null,
      { birthDate: input.admin.birthDate, whatsapp: input.admin.whatsapp },
    );
    // "Também atende" (MANAGER_PROVIDER): registra a ProfessionalSpecialty do
    // admin — espelha a criação atômica da Prisma; gestor-puro não gera nenhuma.
    if (input.professional) {
      this.professionalSpecialtiesByAccountId.set(account.id, {
        specialtyId: input.professional.specialtyId,
        councilDocument: input.professional.councilDocument,
        councilState: input.professional.councilState,
        verificationStatus: 'PENDING',
      });
    }
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
  /**
   * Semeia uma conta criada por OUTRA slice (aceite de convite de
   * paciente/clinica/estagiario/recepcao) no store COMPARTILHADO — em producao
   * todas escrevem na mesma tabela `account`.
   *
   * `profile` existe para o double ser FIEL ao gate (spec §5): cada fluxo passa
   * o que de fato grava. O aceite de clinica nao passa nada e a conta nasce
   * incompleta; os de paciente/estagiario/recepcao passam os tres e nascem
   * completas — igualzinho a Prisma. Sem isso o double diria que todo mundo cai
   * no gate, e o teste do gate provaria o double, nao o produto.
   */
  seedAccount(
    email: string,
    passwordHash: string,
    name: string,
    profile: Partial<ProfileCompletenessFields> = {},
  ): Promise<AccountWithProfileRecord> {
    return this.insert(email, passwordHash, name, null, profile);
  }

  /**
   * Campos do gate que um aceite de convite grava. So nascimento e WhatsApp —
   * endereco nao faz parte do minimo funcional (D-157), entao nao influencia
   * `profileComplete`, mesmo quando o fluxo o coleta.
   */
  static profileFrom(input: {
    birthDate: Date;
    whatsapp: string;
  }): Partial<ProfileCompletenessFields> {
    return { birthDate: input.birthDate, whatsapp: input.whatsapp };
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
    // Campos do gate de completar-perfil (spec §5). Espelham o que CADA fluxo
    // de criacao realmente grava na Prisma — e por isso o double reproduz o
    // gate de verdade: se um fluxo nao coleta nascimento/WhatsApp, aqui tambem
    // nao chegam, e `profileComplete` da false nos dois lados.
    profile: Partial<ProfileCompletenessFields> = {},
  ): Promise<AccountWithProfileRecord> {
    this.sequence += 1;
    const account: AccountWithProfileRecord = {
      id: `acc_${this.sequence}`,
      email,
      passwordHash,
      name,
      socialName,
      emailVerifiedAt: null,
      birthDate: profile.birthDate ?? null,
      whatsapp: profile.whatsapp ?? null,
    };
    this.byId.set(account.id, account);
    this.emailToId.set(email, account.id);
    return Promise.resolve(account);
  }
}

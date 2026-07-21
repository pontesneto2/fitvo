import type { DocumentType } from '@fitvo/database';

/** Projecao minima da conta usada pela autenticacao. */
export interface AccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  /** Momento da verificacao de e-mail (UTC); null enquanto nao verificado (D-029). */
  emailVerifiedAt: Date | null;
}

/**
 * Origem da requisicao de cadastro — usada para o evento ACCEPTED inicial dos
 * termos (D-025). IP/UA vem SEMPRE da requisicao (route layer), nunca do
 * corpo enviado pelo cliente.
 */
export interface TermsAcceptanceOrigin {
  ipAddress: string;
  userAgent: string;
}

export interface CreateProfessionalInput {
  email: string;
  passwordHash: string;
  name: string;
  document: string;
  documentType: DocumentType;
  tenantName: string;
  /**
   * Aceite obrigatorio dos termos no cadastro (D-025). O Zod ja garante, na
   * borda HTTP, que ambos os documentos foram aceitos (`z.literal(true)`) —
   * aqui so a ORIGEM da requisicao, para escrever os dois eventos ACCEPTED
   * (Termos de Uso + Politica de Privacidade) na MESMA transacao da conta.
   */
  termsAcceptance: TermsAcceptanceOrigin;
}

export interface CreatePatientInput {
  email: string;
  passwordHash: string;
  name: string;
  document: string;
  /** Ver `CreateProfessionalInput.termsAcceptance` (D-025). */
  termsAcceptance: TermsAcceptanceOrigin;
}

/**
 * Porta de persistencia da identidade (Repository Pattern). O dominio depende
 * desta interface; a infra fornece a implementacao Prisma (ou in-memory nos testes).
 */
export interface AccountRepository {
  findByEmail(email: string): Promise<AccountRecord | null>;
  findById(id: string): Promise<AccountRecord | null>;
  /** Cria conta + tenant SOLO + perfil profissional atomicamente (D-045). */
  createProfessional(input: CreateProfessionalInput): Promise<AccountRecord>;
  /** Cria conta + perfil de paciente em estado minimo (D-006). */
  createPatient(input: CreatePatientInput): Promise<AccountRecord>;
  /** Marca o e-mail como verificado (idempotente) — D-029. */
  markEmailVerified(id: string): Promise<void>;
  /** Atualiza o hash da senha (recuperacao/troca) — D-029. */
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

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

export interface CreateProfessionalInput {
  email: string;
  passwordHash: string;
  name: string;
  document: string;
  documentType: DocumentType;
  tenantName: string;
}

export interface CreatePatientInput {
  email: string;
  passwordHash: string;
  name: string;
  document: string;
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

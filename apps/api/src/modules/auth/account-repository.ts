import type { DocumentType } from '@fitvo/database';

/** Projecao minima da conta usada pela autenticacao. */
export interface AccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
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
  /** Cria conta + tenant SOLO + perfil profissional atomicamente (D-045). */
  createProfessional(input: CreateProfessionalInput): Promise<AccountRecord>;
  /** Cria conta + perfil de paciente em estado minimo (D-006). */
  createPatient(input: CreatePatientInput): Promise<AccountRecord>;
}

import type { ConsentStatus } from '@fitvo/database';

/**
 * Projecao de um consentimento usada pela slice (D-016). Titular = paciente;
 * NAO ha tenantId de proposito (o consentimento e ato do paciente e pode cruzar
 * tenants — ADR-0003). Datas em UTC (D-067).
 */
export interface ConsentRecord {
  id: string;
  patientProfileId: string;
  granteeProfessionalProfileId: string;
  specialtyId: string;
  status: ConsentStatus;
  grantedAt: Date;
  revokedAt: Date | null;
}

export interface CreateConsentInput {
  patientProfileId: string;
  granteeProfessionalProfileId: string;
  specialtyId: string;
}

/**
 * Porta de persistencia da slice de consentimento (Repository Pattern). O
 * dominio depende desta interface; a infra fornece a implementacao Prisma (ou
 * in-memory nos testes). O escopo aqui e o PACIENTE (titular do dado — D-016),
 * nao um tenant: o consentimento pode cruzar tenants. O isolamento de tenant
 * (D-002) segue valendo em toda OUTRA query do sistema.
 */
export interface ConsentRepository {
  /**
   * Perfil de paciente do chamador (base do guard — D-016). `null` se a conta
   * nao tem perfil de paciente.
   */
  findPatientProfile(accountId: string): Promise<{ patientProfileId: string } | null>;

  /** O profissional que RECEBE o acesso (grantee) existe? (evita FK pendente). */
  professionalExists(professionalProfileId: string): Promise<boolean>;

  /**
   * O paciente tem um vinculo ATIVO nesta especialidade? So se ha vinculo ativo
   * ha dado a compartilhar (pre-condicao do consentimento — ADR-0003/D-016).
   */
  hasActiveBondInSpecialty(patientProfileId: string, specialtyId: string): Promise<boolean>;

  /**
   * Consentimento existente (qualquer status) para a tripla (paciente, grantee,
   * especialidade) — unica. Usado para bloquear duplicata ATIVA e para REABRIR
   * a mesma linha ao reconceder (default documentado).
   */
  findConsent(
    patientProfileId: string,
    granteeProfessionalProfileId: string,
    specialtyId: string,
  ): Promise<ConsentRecord | null>;

  /** Cria um consentimento ATIVO (a tripla ainda nao existia). */
  createConsent(input: CreateConsentInput): Promise<ConsentRecord>;

  /**
   * Reabre um consentimento REVOKED na MESMA linha (ACTIVE + grantedAt=agora +
   * revokedAt=null) — reuso em vez de nova linha (default documentado — D-016).
   */
  reopenConsent(consentId: string): Promise<ConsentRecord>;

  /** Consentimentos do proprio paciente (ATIVOS + historico revogado). */
  listConsents(patientProfileId: string): Promise<ConsentRecord[]>;

  /**
   * Revoga um consentimento ATIVO do paciente (ACTIVE -> REVOKED + revokedAt).
   * `true` se algo foi revogado; `false` se nao ha consentimento ativo com esse
   * id no escopo do paciente.
   */
  revokeConsent(patientProfileId: string, consentId: string): Promise<boolean>;

  /**
   * Ponto de aplicacao FUTURO (D-016): outras slices perguntarao se ha
   * consentimento ATIVO antes de qualquer leitura cruzada de dados. Nenhum
   * endpoint de leitura cruzada existe ainda — este e o gancho de enforcement.
   */
  hasActiveConsent(
    patientProfileId: string,
    granteeProfessionalProfileId: string,
    specialtyId: string,
  ): Promise<boolean>;
}

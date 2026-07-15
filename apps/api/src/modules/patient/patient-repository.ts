import type { BondStatus, InviteStatus } from '@fitvo/database';

/** Projecao do convite profissional->paciente usada pela slice (D-006). */
export interface PatientInviteRecord {
  id: string;
  tenantId: string;
  professionalProfileId: string;
  specialtyId: string;
  email: string;
  status: InviteStatus;
  /** Validade do convite (UTC — D-067). */
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Vinculo (bond) na visao OPERACIONAL do profissional: dado do vinculo + o
 * minimo do paciente que o profissional legitimamente ve (nome/e-mail). Nunca
 * dado clinico de outro profissional (isolamento por vinculo — ADR-0001).
 */
export interface BondRecord {
  id: string;
  patientProfileId: string;
  patientName: string;
  patientEmail: string;
  specialtyId: string;
  status: BondStatus;
  createdAt: Date;
  /** Momento do arquivamento (UTC), null enquanto ativo (D-053). */
  archivedAt: Date | null;
}

export interface CreatePatientInviteInput {
  tenantId: string;
  professionalProfileId: string;
  specialtyId: string;
  email: string;
  /** Hash do token de uso unico — o segredo em claro nunca chega ao repositorio. */
  tokenHash: string;
  expiresAt: Date;
}

/** Dados para criar a conta do paciente quando o e-mail ainda e novo (paciente = CPF — D-043). */
export interface NewPatientAccount {
  passwordHash: string;
  name: string;
  document: string;
}

/**
 * Resultado do aceite (discriminado). O service traduz cada caso: `invalid`
 * (convite inexistente/expirado/revogado/ja aceito) e `bond-conflict` (a tripla
 * paciente+profissional+especialidade ja tem vinculo) viram erros RFC 7807.
 */
export type AcceptPatientInviteOutcome =
  | {
      status: 'accepted';
      tenantId: string;
      accountId: string;
      patientProfileId: string;
      bondId: string;
      specialtyId: string;
      /** `true` se uma conta nova foi criada; `false` se anexada a conta existente. */
      created: boolean;
    }
  | { status: 'invalid' }
  | { status: 'bond-conflict' };

/**
 * Porta de persistencia da slice de paciente/vinculo (Repository Pattern). O
 * dominio depende desta interface; a infra fornece a implementacao Prisma (ou
 * in-memory nos testes). Isolamento de tenant e inegociavel: toda operacao do
 * profissional e escopada por `tenantId` + `professionalProfileId` (D-002). A
 * unica operacao sem escopo de tenant e o aceite por token — o proprio token de
 * uso unico carrega o tenant do convite.
 */
export interface PatientRepository {
  /**
   * Perfil profissional do chamador NESTE tenant (base do guard de convite —
   * D-002/D-006). `null` se a conta nao tem perfil profissional no tenant alvo.
   */
  findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null>;

  /** A especialidade existe no catalogo fixo (D-047)? */
  specialtyExists(specialtyId: string): Promise<boolean>;

  /**
   * O profissional reivindica essa especialidade (tem ProfessionalSpecialty —
   * D-046)? NAO exige VERIFIED no convite (ver TODO D-010 no service).
   */
  professionalHasSpecialty(professionalProfileId: string, specialtyId: string): Promise<boolean>;

  /** Cria o convite (token ja hasheado), escopado ao profissional/tenant. */
  createInvite(input: CreatePatientInviteInput): Promise<PatientInviteRecord>;

  /**
   * Convite PENDENTE para a tripla (tenant, profissional, e-mail, especialidade),
   * se houver — evita duplicata (requisito do convite).
   */
  findPendingInvite(
    tenantId: string,
    professionalProfileId: string,
    email: string,
    specialtyId: string,
  ): Promise<PatientInviteRecord | null>;

  /** Convites PENDENTES do proprio profissional (operacional). */
  listPendingInvites(
    tenantId: string,
    professionalProfileId: string,
  ): Promise<PatientInviteRecord[]>;

  /** Vinculos ATIVOS do proprio profissional (operacional). */
  listActiveBonds(tenantId: string, professionalProfileId: string): Promise<BondRecord[]>;

  /**
   * Reenvia (D-055) um convite PENDENTE do profissional: rotaciona o token e
   * estende a validade NA MESMA linha. Retorna o convite atualizado, ou `null`
   * se nao ha convite pendente com esse id no escopo do profissional.
   */
  resendInvite(
    tenantId: string,
    professionalProfileId: string,
    inviteId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<PatientInviteRecord | null>;

  /** Revoga um convite PENDENTE do profissional. `true` se algo foi revogado. */
  revokeInvite(tenantId: string, professionalProfileId: string, inviteId: string): Promise<boolean>;

  /**
   * Arquiva um vinculo ATIVO do profissional (D-053): ACTIVE -> ARCHIVED +
   * archivedAt. NUNCA apaga. `true` se algo foi arquivado.
   */
  archiveBond(tenantId: string, professionalProfileId: string, bondId: string): Promise<boolean>;

  /**
   * Aceita o convite pelo hash do token, de forma ATOMICA e de USO UNICO: valida
   * PENDING + nao expirado, cria a conta+perfil de paciente (se o e-mail e novo)
   * OU anexa/reusa o perfil de paciente da conta existente, abre o vinculo (tripla
   * unica — conflito se ja existe) e marca o convite ACCEPTED — tudo numa
   * transacao (guard updateMany PENDING->ACCEPTED, race-safe).
   */
  acceptInvite(tokenHash: string, account: NewPatientAccount): Promise<AcceptPatientInviteOutcome>;
}

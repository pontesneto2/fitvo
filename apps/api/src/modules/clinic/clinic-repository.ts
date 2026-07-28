import type {
  BrazilianState,
  ClinicRole,
  DocumentType,
  InviteStatus,
  MedicalSpecialty,
  SpecialtyCode,
} from '@fitvo/database';

import type { RequestOrigin } from '../terms/terms-repository';

/** Projecao do convite de profissional usada pela slice de clinica. */
export interface ProfessionalInviteRecord {
  id: string;
  tenantId: string;
  email: string;
  status: InviteStatus;
  /** Validade do convite (UTC — D-067). */
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Profissional vinculado a uma clinica. SO dado OPERACIONAL (identidade +
 * vinculo) — nunca dado clinico (D-015): admin puro nao acessa dado clinico.
 */
export interface ClinicProfessionalRecord {
  professionalProfileId: string;
  accountId: string;
  name: string;
  email: string;
  displayName: string | null;
  /** Momento em que o profissional passou a integrar a clinica (UTC). */
  joinedAt: Date;
}

export interface CreateInviteInput {
  tenantId: string;
  email: string;
  /** Hash do token de uso unico — o segredo em claro nunca chega ao repositorio. */
  tokenHash: string;
  expiresAt: Date;
  /**
   * Especialidade do convite por CODE (nao id): a clinica escolhe a profissao
   * (ADR-0015/D-137). O repositorio resolve code->Specialty.id (catalogo fixo,
   * D-047) e persiste o id — a FK Restrict guarda contra id fora do catalogo.
   */
  specialtyCode: SpecialtyCode;
  /** Registro no conselho (formato — D-138); a clinica preenche no convite. */
  councilDocument: string;
  /** UF do conselho (D-126). */
  councilState: BrazilianState;
  /** Especialidade medica — presente sse `specialtyCode === 'MEDICINE'` (regra no Zod). */
  medicalSpecialty?: MedicalSpecialty | undefined;
}

/** Dados para criar a conta do profissional quando o e-mail ainda e novo. */
export interface NewProfessionalAccount {
  passwordHash: string;
  name: string;
  document: string;
  documentType: DocumentType;
}

/**
 * Resultado do aceite (discriminado). O service traduz cada caso: `invalid`
 * (convite inexistente/expirado/revogado/ja aceito) e `conflict` (conta ja
 * possui perfil profissional — 1:1 no modelo atual) viram erros RFC 7807.
 */
export type AcceptInviteOutcome =
  | { status: 'accepted'; tenantId: string; accountId: string; created: boolean }
  | { status: 'invalid' }
  | { status: 'conflict' };

/**
 * Porta de persistencia da clinica (Repository Pattern). O dominio depende
 * desta interface; a infra fornece a implementacao Prisma (ou in-memory nos
 * testes). Isolamento de tenant e inegociavel: toda operacao administrativa e
 * escopada por `tenantId` (D-002). A unica leitura sem escopo de tenant e o
 * aceite por token — o proprio token de uso unico carrega o tenant do convite.
 */
export interface ClinicRepository {
  /** Membership do chamador nesta clinica (base do guard de admin — D-013). */
  findMembership(accountId: string, tenantId: string): Promise<{ role: ClinicRole } | null>;

  /** Cria o convite (token ja hasheado), escopado ao tenant da clinica. */
  createInvite(input: CreateInviteInput): Promise<ProfessionalInviteRecord>;

  /** Convite PENDENTE para o e-mail nesta clinica, se houver (evita duplicata). */
  findPendingInviteByEmail(
    tenantId: string,
    email: string,
  ): Promise<ProfessionalInviteRecord | null>;

  /** Convites PENDENTES da clinica (operacional — D-015). */
  listPendingInvites(tenantId: string): Promise<ProfessionalInviteRecord[]>;

  /** Profissionais vinculados a clinica (operacional — D-015). */
  listProfessionals(tenantId: string): Promise<ClinicProfessionalRecord[]>;

  /** Revoga um convite PENDENTE da clinica. `true` se algo foi de fato revogado. */
  revokeInvite(tenantId: string, inviteId: string): Promise<boolean>;

  /**
   * Aceita o convite pelo hash do token, de forma ATOMICA e de USO UNICO
   * (D-048): valida PENDING + nao expirado, cria a conta (se o e-mail e novo)
   * OU vincula o perfil a conta existente, e marca o convite ACCEPTED — tudo
   * numa transacao. Na MESMA transacao cria a ProfessionalSpecialty (especialidade
   * + conselho + medicalSpecialty lidos DO CONVITE, PENDING) e, SO quando a conta
   * e nova, grava o aceite inicial dos termos (D-025 — LGPD) a partir do `origin`.
   * NAO cria tenant SOLO: o profissional entra na clinica do convite (a unica
   * porta de entrada numa clinica — D-048).
   */
  acceptInvite(
    tokenHash: string,
    account: NewProfessionalAccount,
    origin: RequestOrigin,
  ): Promise<AcceptInviteOutcome>;
}

import type {
  BrazilianState,
  DocumentType,
  Gender,
  InviteStatus,
  SpecialtyCode,
} from '@fitvo/database';

import type { AddressInput } from '../auth/account-repository';
import type { RequestOrigin } from '../terms/terms-repository';

/** Projecao do convite de estagiario usada pela slice (D-142). */
export interface InternInviteRecord {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  status: InviteStatus;
  /** Responsavel fixado no convite — NUNCA nulo (regra legal, D-142). */
  supervisorProfessionalProfileId: string;
  /** Validade do convite (UTC — D-067). */
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Profissional ELEGIVEL a supervisionar estagiario (D-142): perfil do PROPRIO
 * tenant, com especialidade de CREF (TRAINING/PERSONAL_TRAINER) e conselho
 * preenchido. SO dado OPERACIONAL (D-015). "Conselho preenchido" e o criterio de
 * "ativo" possivel hoje — a verificacao de registro ativo de verdade segue
 * deferida (D-138/TODO(D-010)).
 */
export interface InternSupervisorRecord {
  professionalProfileId: string;
  accountId: string;
  displayName: string;
  specialtyCode: SpecialtyCode;
  councilDocument: string;
  councilState: BrazilianState;
}

export interface CreateInternInviteInput {
  tenantId: string;
  email: string;
  name?: string | undefined;
  /** Hash do token de uso unico — o segredo em claro nunca chega ao repositorio. */
  tokenHash: string;
  expiresAt: Date;
  /** Responsavel OBRIGATORIO. Nao ha overload sem ele: o tipo e a regra. */
  supervisorProfessionalProfileId: string;
}

/** Dados para criar a conta do estagiario quando o e-mail ainda e novo. */
export interface NewInternAccount {
  passwordHash: string;
  name: string;
  socialName?: string | undefined;
  gender?: Gender | undefined;
  document: string;
  documentType: DocumentType;
  whatsapp: string;
  birthDate: Date;
  address: AddressInput;
}

/**
 * Resultado do aceite (discriminado). O service traduz cada caso: `invalid`
 * (convite inexistente/expirado/revogado/ja aceito) e `conflict` (a conta ja tem
 * um seat de estagiario — 1:1 no modelo) viram erros RFC 7807.
 */
export type AcceptInternInviteOutcome =
  | {
      status: 'accepted';
      tenantId: string;
      accountId: string;
      supervisorProfessionalProfileId: string;
      created: boolean;
    }
  | { status: 'invalid' }
  | { status: 'conflict' };

/**
 * Porta de persistencia do seat de estagiario (Repository Pattern). Isolamento
 * de tenant inegociavel (D-002): toda operacao administrativa e escopada por
 * `tenantId`. A unica leitura sem escopo de tenant e o aceite por token — o
 * proprio token de uso unico carrega o tenant do convite.
 */
export interface InternRepository {
  /**
   * Profissionais do tenant elegiveis a supervisionar (D-142). E a MESMA consulta
   * que valida o responsavel na criacao do convite — um criterio so, num lugar
   * so: a lista que a academia ve e exatamente o conjunto que o convite aceita.
   */
  listEligibleSupervisors(tenantId: string): Promise<InternSupervisorRecord[]>;

  /**
   * O responsavel indicado e elegivel NESTE tenant? Guard do convite (D-142):
   * impede apontar para profissional de outro tenant (vazamento entre tenants),
   * para quem nao tem CREF (medico/nutricionista nao supervisiona estagiario de
   * educacao fisica) ou para quem esta sem conselho preenchido.
   */
  isEligibleSupervisor(tenantId: string, professionalProfileId: string): Promise<boolean>;

  /** Cria o convite (token ja hasheado), escopado ao tenant da academia. */
  createInvite(input: CreateInternInviteInput): Promise<InternInviteRecord>;

  /** Convite PENDENTE para o e-mail neste tenant, se houver (evita duplicata). */
  findPendingInviteByEmail(tenantId: string, email: string): Promise<InternInviteRecord | null>;

  /**
   * Aceita o convite pelo hash do token, de forma ATOMICA e de USO UNICO: valida
   * PENDING + nao expirado, cria a conta (se o e-mail e novo) OU vincula o seat a
   * conta existente, e marca o convite ACCEPTED — tudo numa transacao. O
   * InternProfile nasce na MESMA transacao com o responsavel LIDO DO CONVITE (o
   * estagiario nao escolhe quem o supervisiona) e, SO quando a conta e nova,
   * grava o aceite inicial dos termos (D-025 — LGPD) a partir do `origin`.
   */
  acceptInvite(
    tokenHash: string,
    account: NewInternAccount,
    origin: RequestOrigin,
  ): Promise<AcceptInternInviteOutcome>;
}

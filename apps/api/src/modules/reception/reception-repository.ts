import type { DocumentType, Gender, InviteStatus } from '@fitvo/database';

import type { AddressInput } from '../auth/account-repository';
import type { RequestOrigin } from '../terms/terms-repository';

/** Projecao do convite de recepcao usada pela slice (D-156). */
export interface ReceptionInviteRecord {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  status: InviteStatus;
  /** Validade do convite (UTC — D-067). */
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateReceptionInviteInput {
  tenantId: string;
  email: string;
  name?: string | undefined;
  /** Hash do token de uso unico — o segredo em claro nunca chega ao repositorio. */
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Dados para criar a conta da recepcionista quando o e-mail ainda e novo.
 * Campos COMPLETOS (spec §4.5): nascimento, endereco e WhatsApp entram aqui,
 * no aceite — e por isso o seat nasce com perfil completo, sem cair no gate de
 * completar-perfil (spec §5).
 *
 * NAO ha conselho, especialidade nem sexo biologico: os dois primeiros
 * qualificam quem ATENDE, e o terceiro e base de calculo clinico de PACIENTE.
 */
export interface NewReceptionAccount {
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
 * um seat de recepcao — 1:1 no modelo) viram erros RFC 7807.
 */
export type AcceptReceptionInviteOutcome =
  | { status: 'accepted'; tenantId: string; accountId: string; created: boolean }
  | { status: 'invalid' }
  | { status: 'conflict' };

/**
 * Porta de persistencia do seat de recepcao (Repository Pattern). Isolamento de
 * tenant inegociavel (D-002): toda operacao administrativa e escopada por
 * `tenantId`. A unica leitura sem escopo de tenant e o aceite por token — o
 * proprio token de uso unico carrega o tenant do convite.
 */
export interface ReceptionRepository {
  /** Cria o convite (token ja hasheado), escopado ao tenant da empresa. */
  createInvite(input: CreateReceptionInviteInput): Promise<ReceptionInviteRecord>;

  /** Convite PENDENTE para o e-mail neste tenant, se houver (evita duplicata). */
  findPendingInviteByEmail(tenantId: string, email: string): Promise<ReceptionInviteRecord | null>;

  /**
   * Aceita o convite pelo hash do token, de forma ATOMICA e de USO UNICO: valida
   * PENDING + nao expirado, cria a conta (se o e-mail e novo) OU vincula o seat a
   * conta existente, e marca o convite ACCEPTED — tudo numa transacao. O
   * ReceptionProfile nasce na MESMA transacao, no tenant LIDO DO CONVITE, e SO
   * quando a conta e nova grava o aceite inicial dos termos (D-025 — LGPD) a
   * partir do `origin`.
   */
  acceptInvite(
    tokenHash: string,
    account: NewReceptionAccount,
    origin: RequestOrigin,
  ): Promise<AcceptReceptionInviteOutcome>;
}

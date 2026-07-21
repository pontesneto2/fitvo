import type { PasswordHasher } from '@fitvo/auth';
import type { DocumentType, InviteStatus } from '@fitvo/database';

import type {
  AccessTokenVerifier,
  AuthContext,
  EmailVerificationLookup,
  TermsAcceptanceLookup,
} from '../../shared/auth-context';
import {
  requireAuth,
  requireCurrentTermsAcceptance,
  requireVerifiedEmail,
} from '../../shared/auth-context';
import {
  ForbiddenError,
  InvalidInviteTokenError,
  InvitePendingConflictError,
  NotFoundError,
  ProfessionalProfileConflictError,
} from '../../shared/http-errors';
import type {
  ClinicProfessionalRecord,
  ClinicRepository,
  ProfessionalInviteRecord,
} from './clinic-repository';
import { generateInviteToken, hashInviteToken } from './invite-token';

/** Projecao do convite exposta na API (datas em ISO UTC — D-067). */
export interface InviteView {
  id: string;
  email: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

/** Profissional da clinica exposto na API (dado OPERACIONAL — D-015). */
export interface ClinicProfessionalView {
  accountId: string;
  professionalProfileId: string;
  name: string;
  email: string;
  displayName: string | null;
  joinedAt: string;
}

export interface CreateInviteResult {
  invite: InviteView;
  /**
   * Token em claro — devolvido UMA vez ao admin. Nesta fase a entrega por
   * e-mail esta fora de escopo; o admin repassa o link ao profissional. O
   * token nunca e persistido nem registrado em log (so o hash vai ao banco).
   */
  token: string;
}

export interface ClinicRosterResult {
  professionals: ClinicProfessionalView[];
  pendingInvites: InviteView[];
}

export interface AcceptInviteInput {
  token: string;
  password: string;
  name: string;
  document: string;
  documentType: DocumentType;
}

export interface AcceptInviteResult {
  professional: { accountId: string; tenantId: string };
  /** `true` se uma conta nova foi criada; `false` se um perfil foi anexado a conta existente. */
  created: boolean;
}

function toInviteView(invite: ProfessionalInviteRecord): InviteView {
  return {
    id: invite.id,
    email: invite.email,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  };
}

function toProfessionalView(professional: ClinicProfessionalRecord): ClinicProfessionalView {
  return {
    accountId: professional.accountId,
    professionalProfileId: professional.professionalProfileId,
    name: professional.name,
    email: professional.email,
    displayName: professional.displayName,
    joinedAt: professional.joinedAt.toISOString(),
  };
}

/**
 * Servico de aplicacao da clinica (vertical slice). Convites admin->profissional
 * (D-014/D-048/D-049): criacao (token de uso unico), listagem operacional do
 * corpo clinico + pendentes (D-015: nunca dado clinico), revogacao e aceite. O
 * guard de admin (RBAC — D-013) reusa `requireAuth` (shared) e checa a
 * ClinicMembership CLINIC_ADMIN do tenant alvo. Tenant isolado em toda operacao
 * administrativa (D-002); o aceite se autentica pelo proprio token do convite.
 */
export class ClinicApplicationService {
  constructor(
    private readonly clinic: ClinicRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokenVerifier: AccessTokenVerifier,
    private readonly inviteTtlSeconds: number,
    /** Gate de e-mail verificado (D-029) ao convidar. */
    private readonly emailVerification: EmailVerificationLookup,
    /**
     * Gate de re-consentimento de termos (D-025) ao convidar — mesma familia e
     * mesma posicao no chain do gate de e-mail verificado.
     * TODO(D-025): hoje so gateamos TERMS_OF_USE neste call site; avaliar se
     * PRIVACY_POLICY tambem deveria ser exigido aqui.
     */
    private readonly termsAcceptance: TermsAcceptanceLookup,
  ) {}

  /** Admin cria um convite para um profissional. Devolve o token em claro 1x. */
  async createInvite(
    authorization: string | undefined,
    tenantId: string,
    input: { email: string },
  ): Promise<CreateInviteResult> {
    const ctx = await this.requireClinicAdmin(authorization, tenantId);
    await requireVerifiedEmail(this.emailVerification, ctx.accountId);
    await requireCurrentTermsAcceptance(this.termsAcceptance, ctx.accountId, 'TERMS_OF_USE');
    const pending = await this.clinic.findPendingInviteByEmail(tenantId, input.email);
    if (pending) {
      throw new InvitePendingConflictError();
    }
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + this.inviteTtlSeconds * 1000);
    const invite = await this.clinic.createInvite({
      tenantId,
      email: input.email,
      tokenHash: hashInviteToken(token),
      expiresAt,
    });
    return { invite: toInviteView(invite), token };
  }

  /** Admin lista o corpo profissional + convites pendentes (operacional — D-015). */
  async listRoster(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<ClinicRosterResult> {
    await this.requireClinicAdmin(authorization, tenantId);
    const [professionals, pendingInvites] = await Promise.all([
      this.clinic.listProfessionals(tenantId),
      this.clinic.listPendingInvites(tenantId),
    ]);
    return {
      professionals: professionals.map(toProfessionalView),
      pendingInvites: pendingInvites.map(toInviteView),
    };
  }

  /** Admin revoga um convite pendente da clinica. */
  async revokeInvite(
    authorization: string | undefined,
    tenantId: string,
    inviteId: string,
  ): Promise<void> {
    await this.requireClinicAdmin(authorization, tenantId);
    const revoked = await this.clinic.revokeInvite(tenantId, inviteId);
    if (!revoked) {
      throw new NotFoundError('Convite pendente nao encontrado nesta clinica.');
    }
  }

  /**
   * Profissional aceita o convite pelo token (endpoint publico — o token de uso
   * unico e a propria autorizacao). Cria a conta (se nova) OU vincula o perfil a
   * conta existente, sempre no tenant da clinica do convite (D-048).
   */
  async acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
    const passwordHash = await this.hasher.hash(input.password);
    const outcome = await this.clinic.acceptInvite(hashInviteToken(input.token), {
      passwordHash,
      name: input.name,
      document: input.document,
      documentType: input.documentType,
    });
    if (outcome.status === 'invalid') {
      throw new InvalidInviteTokenError();
    }
    if (outcome.status === 'conflict') {
      throw new ProfessionalProfileConflictError();
    }
    return {
      professional: { accountId: outcome.accountId, tenantId: outcome.tenantId },
      created: outcome.created,
    };
  }

  /** Guard de admin de clinica (RBAC — D-013): Bearer valido + CLINIC_ADMIN do tenant. */
  private async requireClinicAdmin(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<AuthContext> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const membership = await this.clinic.findMembership(ctx.accountId, tenantId);
    if (!membership || membership.role !== 'CLINIC_ADMIN') {
      throw new ForbiddenError('Requer admin desta clinica.');
    }
    return ctx;
  }
}

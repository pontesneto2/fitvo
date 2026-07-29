import type { PasswordHasher } from '@fitvo/auth';
import type { ClinicRole, DocumentType, Gender, InviteStatus } from '@fitvo/database';

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
  ReceptionProfileConflictError,
} from '../../shared/http-errors';
import { generateInviteToken, hashInviteToken } from '../../shared/invite-token';
import type { AddressInput } from '../auth/account-repository';
import type { RequestOrigin } from '../terms/terms-repository';
import type { ReceptionInviteRecord, ReceptionRepository } from './reception-repository';

/**
 * Membership de admin no tenant — interface ESTREITA (nao o repositorio de
 * clinica inteiro), mesmo padrao de `EmailVerificationLookup`. A
 * `ClinicRepository` satisfaz esta forma; o slice de recepcao nao passa a
 * depender dela.
 */
export interface ClinicAdminLookup {
  findMembership(accountId: string, tenantId: string): Promise<{ role: ClinicRole } | null>;
}

/** Projecao do convite exposta na API (datas em ISO UTC — D-067). */
export interface ReceptionInviteView {
  id: string;
  email: string;
  name: string | null;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

export interface ReceptionCreateInviteResult {
  invite: ReceptionInviteView;
  /**
   * Token em claro — devolvido UMA vez ao admin. Nesta fase a entrega por
   * e-mail esta fora de escopo; o admin repassa o link. O token nunca e
   * persistido nem registrado em log (so o hash vai ao banco).
   */
  token: string;
}

/** Payload da Fase A: e-mail e nome opcional. Nada mais — recepcao nao tem
 * profissao, conselho, especialidade nem responsavel. */
export interface ReceptionCreateInviteBody {
  email: string;
  name?: string | undefined;
}

/** Payload da Fase B: a recepcionista completa a propria identidade. */
export interface ReceptionAcceptInviteInput {
  token: string;
  password: string;
  name: string;
  socialName?: string | undefined;
  gender?: Gender | undefined;
  document: string;
  documentType: DocumentType;
  whatsapp: string;
  /** `YYYY-MM-DD` no fio — convertido para Date no boundary do repositorio. */
  birthDate: string;
  address: AddressInput;
  /** Origem (IP/UA) da requisicao — grava o aceite inicial dos termos (D-025). */
  origin: RequestOrigin;
}

export interface ReceptionAcceptInviteResult {
  reception: {
    accountId: string;
    tenantId: string;
    /**
     * Rotulo do seat. Nao ha coluna correspondente no banco — a existencia da
     * linha `reception_profile` ja e o fato (D-103). O rotulo existe no
     * CONTRATO, para quem consome a API distinguir seats.
     */
    seatType: 'RECEPTION';
  };
  created: boolean;
}

function toInviteView(invite: ReceptionInviteRecord): ReceptionInviteView {
  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  };
}

/**
 * Servico de aplicacao do seat de RECEPCAO (vertical slice — D-156).
 *
 * Recepcao e seat ADMINISTRATIVO: opera agenda e cadastro (dado operacional —
 * D-015) e NUNCA acessa dado clinico. Entra so por convite do admin da empresa
 * (spec §1/§4.5) — nao ha autocadastro —, no mesmo molde de duas fases do
 * profissional de clinica (#102) e do estagiario (D-142), sem conselho,
 * especialidade nem responsavel.
 *
 * O guard de admin (RBAC — D-013) reusa `requireAuth` e checa a ClinicMembership
 * CLINIC_ADMIN do tenant alvo. Tenant isolado em toda operacao administrativa
 * (D-002); o aceite se autentica pelo proprio token do convite.
 */
export class ReceptionApplicationService {
  constructor(
    private readonly receptions: ReceptionRepository,
    private readonly memberships: ClinicAdminLookup,
    private readonly hasher: PasswordHasher,
    private readonly tokenVerifier: AccessTokenVerifier,
    private readonly inviteTtlSeconds: number,
    /** Gate de e-mail verificado (D-029) ao convidar. */
    private readonly emailVerification: EmailVerificationLookup,
    /** Gate de re-consentimento de termos (D-025) ao convidar. */
    private readonly termsAcceptance: TermsAcceptanceLookup,
  ) {}

  /**
   * Fase A — o admin pre-cadastra a recepcionista. Devolve o token em claro 1x.
   */
  async createInvite(
    authorization: string | undefined,
    tenantId: string,
    input: ReceptionCreateInviteBody,
  ): Promise<ReceptionCreateInviteResult> {
    const ctx = await this.requireCompanyAdmin(authorization, tenantId);
    await requireVerifiedEmail(this.emailVerification, ctx.accountId);
    await requireCurrentTermsAcceptance(this.termsAcceptance, ctx.accountId, 'TERMS_OF_USE');
    await requireCurrentTermsAcceptance(this.termsAcceptance, ctx.accountId, 'PRIVACY_POLICY');

    const pending = await this.receptions.findPendingInviteByEmail(tenantId, input.email);
    if (pending) {
      throw new InvitePendingConflictError();
    }

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + this.inviteTtlSeconds * 1000);
    const invite = await this.receptions.createInvite({
      tenantId,
      email: input.email,
      name: input.name,
      tokenHash: hashInviteToken(token),
      expiresAt,
    });
    return { invite: toInviteView(invite), token };
  }

  /**
   * Fase B — a recepcionista aceita pelo token (endpoint publico: o token de uso
   * unico e a propria autorizacao) e completa a identidade. O tenant NAO vem
   * daqui: e lido do convite dentro da transacao.
   */
  async acceptInvite(input: ReceptionAcceptInviteInput): Promise<ReceptionAcceptInviteResult> {
    const passwordHash = await this.hasher.hash(input.password);
    const outcome = await this.receptions.acceptInvite(
      hashInviteToken(input.token),
      {
        passwordHash,
        name: input.name,
        socialName: input.socialName,
        gender: input.gender,
        document: input.document,
        documentType: input.documentType,
        whatsapp: input.whatsapp,
        // `YYYY-MM-DD` (calendario) -> Date UTC midnight, sem hora: o schema ja
        // validou formato e maioridade; aqui so a conversao para o boundary
        // Prisma (@db.Date).
        birthDate: new Date(`${input.birthDate}T00:00:00Z`),
        address: input.address,
      },
      input.origin,
    );
    if (outcome.status === 'invalid') {
      throw new InvalidInviteTokenError();
    }
    if (outcome.status === 'conflict') {
      throw new ReceptionProfileConflictError();
    }
    return {
      reception: {
        accountId: outcome.accountId,
        tenantId: outcome.tenantId,
        seatType: 'RECEPTION',
      },
      created: outcome.created,
    };
  }

  /**
   * Guard de admin (RBAC — D-013): Bearer valido + CLINIC_ADMIN do tenant. Vale
   * para clinica e academia — a membership de admin de empresa e a mesma nas
   * duas verticais, e o seat de recepcao existe nas duas (spec §2).
   */
  private async requireCompanyAdmin(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<AuthContext> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const membership = await this.memberships.findMembership(ctx.accountId, tenantId);
    if (!membership || membership.role !== 'CLINIC_ADMIN') {
      throw new ForbiddenError('Requer admin desta empresa.');
    }
    return ctx;
  }
}

import type { PasswordHasher } from '@fitvo/auth';
import type { ClinicRole, DocumentType, Gender, InternArea, InviteStatus } from '@fitvo/database';

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
  IneligibleSupervisorError,
  InternProfileConflictError,
  InvalidInviteTokenError,
  InvitePendingConflictError,
} from '../../shared/http-errors';
import { generateInviteToken, hashInviteToken } from '../../shared/invite-token';
import type { AddressInput } from '../auth/account-repository';
import type { RequestOrigin } from '../terms/terms-repository';
import type {
  InternInviteRecord,
  InternRepository,
  InternSupervisorRecord,
} from './intern-repository';

/**
 * Membership de admin no tenant — interface ESTREITA (não o repositório de
 * clínica inteiro), mesmo padrão de `EmailVerificationLookup`/
 * `TermsAcceptanceLookup` para dependência cross-slice. A `ClinicRepository`
 * satisfaz esta forma; o slice de estagiário não passa a depender dela.
 */
export interface ClinicAdminLookup {
  findMembership(accountId: string, tenantId: string): Promise<{ role: ClinicRole } | null>;
}

/** Projecao do convite exposta na API (datas em ISO UTC — D-067). */
export interface InternInviteView {
  id: string;
  email: string;
  name: string | null;
  area: InternArea;
  status: InviteStatus;
  supervisorProfessionalProfileId: string;
  expiresAt: string;
  createdAt: string;
}

export interface InternCreateInviteResult {
  invite: InternInviteView;
  /**
   * Token em claro — devolvido UMA vez ao admin. Nesta fase a entrega por
   * e-mail está fora de escopo; o admin repassa o link ao estagiário. O token
   * nunca é persistido nem registrado em log (só o hash vai ao banco).
   */
  token: string;
}

/** Payload da Fase A: e-mail, ÁREA, nome opcional e o RESPONSÁVEL (obrigatório). */
export interface InternCreateInviteBody {
  email: string;
  area: InternArea;
  name?: string | undefined;
  supervisorProfessionalProfileId: string;
}

/** Payload da Fase B: o estagiário completa a própria identidade. */
export interface InternAcceptInviteInput {
  token: string;
  password: string;
  name: string;
  socialName?: string | undefined;
  gender?: Gender | undefined;
  document: string;
  documentType: DocumentType;
  whatsapp: string;
  /** `YYYY-MM-DD` no fio — convertido para Date no boundary do repositório. */
  birthDate: string;
  address: AddressInput;
  /** Origem (IP/UA) da requisicao — grava o aceite inicial dos termos (D-025). */
  origin: RequestOrigin;
}

export interface InternAcceptInviteResult {
  intern: {
    accountId: string;
    tenantId: string;
    /**
     * Rótulo do seat. Não há coluna correspondente no banco — a existência da
     * linha `intern_profile` já é o fato (ver a nota do modelo no schema). O
     * rótulo existe no CONTRATO, para quem consome a API distinguir seats.
     */
    seatType: 'STUDENT_INTERN';
    /** Área de estágio, vinda do convite (D-143). */
    area: InternArea;
    supervisorProfessionalProfileId: string;
  };
  created: boolean;
}

export interface InternSupervisorListResult {
  supervisors: InternSupervisorRecord[];
}

function toInviteView(invite: InternInviteRecord): InternInviteView {
  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    area: invite.area,
    status: invite.status,
    supervisorProfessionalProfileId: invite.supervisorProfessionalProfileId,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  };
}

/**
 * Serviço de aplicação do seat de ESTAGIÁRIO (vertical slice — D-142).
 *
 * O estagiário **NUNCA** se autocadastra (spec §1/§6): é estudante sem conselho
 * e atuar sem supervisão é exercício ilegal da profissão. Por isso só existe o
 * fluxo de convite em duas fases — molde do convite de profissional de clínica
 * (#102) — com a regra legal embutida: **todo convite carrega um responsável
 * elegível**, checado aqui e NOT NULL no banco.
 *
 * O guard de admin (RBAC — D-013) reusa `requireAuth` e checa a ClinicMembership
 * CLINIC_ADMIN do tenant alvo. Tenant isolado em toda operação administrativa
 * (D-002); o aceite se autentica pelo próprio token do convite.
 */
export class InternApplicationService {
  constructor(
    private readonly interns: InternRepository,
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
   * Responsáveis elegíveis do tenant (Fase A): é a lista que a academia escolhe.
   * Mesma consulta que o guard do convite usa — o que aparece aqui é exatamente
   * o que o POST aceita.
   */
  async listEligibleSupervisors(
    authorization: string | undefined,
    tenantId: string,
    area: InternArea,
  ): Promise<InternSupervisorListResult> {
    await this.requireCompanyAdmin(authorization, tenantId);
    return { supervisors: await this.interns.listEligibleSupervisors(tenantId, area) };
  }

  /**
   * Fase A — a academia pré-cadastra o estagiário. Devolve o token em claro 1x.
   * O responsável é validado ANTES de qualquer escrita: um estagiário sem
   * responsável elegível não chega nem a ter convite.
   */
  async createInvite(
    authorization: string | undefined,
    tenantId: string,
    input: InternCreateInviteBody,
  ): Promise<InternCreateInviteResult> {
    const ctx = await this.requireCompanyAdmin(authorization, tenantId);
    await requireVerifiedEmail(this.emailVerification, ctx.accountId);
    await requireCurrentTermsAcceptance(this.termsAcceptance, ctx.accountId, 'TERMS_OF_USE');
    await requireCurrentTermsAcceptance(this.termsAcceptance, ctx.accountId, 'PRIVACY_POLICY');

    // Responsável elegível NESTE tenant, PARA ESTA ÁREA (D-142/D-143). É dado de
    // OUTRO registro (o conselho do supervisor), então o Zod não alcança: a
    // checagem é contra o banco. Barra três coisas de uma vez — profissional de
    // outro tenant (isolamento — D-002), conselho de outra área (um CREF não
    // supervisiona estagiário de nutrição) e conselho em branco.
    if (
      !(await this.interns.isEligibleSupervisor(
        tenantId,
        input.area,
        input.supervisorProfessionalProfileId,
      ))
    ) {
      throw new IneligibleSupervisorError();
    }

    const pending = await this.interns.findPendingInviteByEmail(tenantId, input.email);
    if (pending) {
      throw new InvitePendingConflictError();
    }

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + this.inviteTtlSeconds * 1000);
    const invite = await this.interns.createInvite({
      tenantId,
      email: input.email,
      area: input.area,
      name: input.name,
      tokenHash: hashInviteToken(token),
      expiresAt,
      supervisorProfessionalProfileId: input.supervisorProfessionalProfileId,
    });
    return { invite: toInviteView(invite), token };
  }

  /**
   * Fase B — o estagiário aceita pelo token (endpoint público: o token de uso
   * único é a própria autorização) e completa a identidade. O responsável NÃO
   * vem daqui: é lido do convite dentro da transação.
   */
  async acceptInvite(input: InternAcceptInviteInput): Promise<InternAcceptInviteResult> {
    const passwordHash = await this.hasher.hash(input.password);
    const outcome = await this.interns.acceptInvite(
      hashInviteToken(input.token),
      {
        passwordHash,
        name: input.name,
        socialName: input.socialName,
        gender: input.gender,
        document: input.document,
        documentType: input.documentType,
        whatsapp: input.whatsapp,
        // `YYYY-MM-DD` (calendário) → Date UTC midnight, sem hora: o schema já
        // validou formato e maioridade; aqui só a conversão para o boundary
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
      throw new InternProfileConflictError();
    }
    return {
      intern: {
        accountId: outcome.accountId,
        tenantId: outcome.tenantId,
        seatType: 'STUDENT_INTERN',
        area: outcome.area,
        supervisorProfessionalProfileId: outcome.supervisorProfessionalProfileId,
      },
      created: outcome.created,
    };
  }

  /**
   * Guard de admin (RBAC — D-013): Bearer válido + CLINIC_ADMIN do tenant. Vale
   * para clínica e academia — a membership de admin de empresa é a mesma nas
   * duas verticais, e desde D-143 o seat de estagiário existe nas duas.
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

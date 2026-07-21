import type { PasswordHasher } from '@fitvo/auth';
import type { BondStatus, CareModality, InviteStatus } from '@fitvo/database';
import { BOND_CREATED_EVENT, type BondCreatedEvent, type Queue } from '@fitvo/queue';

import type {
  AccessTokenVerifier,
  EmailVerificationLookup,
  TermsAcceptanceLookup,
} from '../../shared/auth-context';
import {
  requireAuth,
  requireCurrentTermsAcceptance,
  requireVerifiedEmail,
} from '../../shared/auth-context';
import {
  BondAlreadyExistsError,
  ForbiddenError,
  InvalidInviteTokenError,
  InvitePendingConflictError,
  NotFoundError,
} from '../../shared/http-errors';
import { generateInviteToken, hashInviteToken } from '../clinic/invite-token';
import type { BondRecord, PatientInviteRecord, PatientRepository } from './patient-repository';

/** Projecao do convite de paciente exposta na API (datas em ISO UTC — D-067). */
export interface PatientInviteView {
  id: string;
  email: string;
  specialtyId: string;
  modality: CareModality;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

/** Vinculo exposto na API (visao operacional do profissional — ADR-0001). */
export interface BondView {
  id: string;
  patientProfileId: string;
  patientName: string;
  patientEmail: string;
  specialtyId: string;
  modality: CareModality;
  status: BondStatus;
  createdAt: string;
  archivedAt: string | null;
}

export interface CreatePatientInviteResult {
  invite: PatientInviteView;
  /**
   * Token em claro — devolvido UMA vez ao profissional. Nesta fase a entrega por
   * push/e-mail (ADR-0002) esta fora de escopo; o profissional repassa o link. O
   * token nunca e persistido nem registrado em log (so o hash vai ao banco).
   */
  token: string;
}

export interface PatientOverviewResult {
  pendingInvites: PatientInviteView[];
  activeBonds: BondView[];
}

export interface AcceptPatientInviteInput {
  token: string;
  password: string;
  name: string;
  document: string;
}

export interface AcceptPatientInviteResult {
  patient: { accountId: string; tenantId: string; patientProfileId: string };
  bond: { id: string; specialtyId: string };
  /** `true` se uma conta nova foi criada; `false` se um perfil foi anexado a conta existente. */
  created: boolean;
}

function toInviteView(invite: PatientInviteRecord): PatientInviteView {
  return {
    id: invite.id,
    email: invite.email,
    specialtyId: invite.specialtyId,
    modality: invite.modality,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  };
}

function toBondView(bond: BondRecord): BondView {
  return {
    id: bond.id,
    patientProfileId: bond.patientProfileId,
    patientName: bond.patientName,
    patientEmail: bond.patientEmail,
    specialtyId: bond.specialtyId,
    modality: bond.modality,
    status: bond.status,
    createdAt: bond.createdAt.toISOString(),
    archivedAt: bond.archivedAt ? bond.archivedAt.toISOString() : null,
  };
}

/**
 * Servico de aplicacao da slice paciente/vinculo (D-006/D-052/D-053/D-055).
 * Convite profissional->paciente direcionado a UMA especialidade; o aceite abre
 * o vinculo (bond) naquele "ambiente" (ADR-0001). Fluxo do profissional: criar
 * convite (token de uso unico), visao operacional (pendentes + vinculos ativos),
 * reenviar (rotaciona token + estende validade — D-055), revogar e arquivar o
 * vinculo (ACTIVE->ARCHIVED, nunca apaga — D-053). O aceite e publico
 * (autorizado pelo token). Guard de convite reusa `requireAuth` (shared) e checa
 * o perfil profissional no tenant alvo; tenant isolado em toda operacao (D-002).
 * Criar/reenviar convite tambem exige e-mail verificado (D-029 — gate de acao
 * sensivel, nunca bloqueia login); o aceite publico NAO passa por este gate.
 */
export class PatientApplicationService {
  constructor(
    private readonly patients: PatientRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokenVerifier: AccessTokenVerifier,
    private readonly inviteTtlSeconds: number,
    /**
     * Fila de eventos do motor de compartilhamento (D-017). O aceite publica
     * `bond.created` para alimentar a deteccao de sobreposicao no worker. O tipo
     * `Queue` (porta de @fitvo/queue) basta como EventPublisher — sem acoplar a
     * slice a uma implementacao concreta (BullMQ em prod, in-memory nos testes).
     */
    private readonly bondEvents: Queue<BondCreatedEvent>,
    /** Gate de e-mail verificado (D-029) ao convidar/reenviar convite. */
    private readonly emailVerification: EmailVerificationLookup,
    /**
     * Gate de re-consentimento de termos (D-025) ao convidar/reenviar convite —
     * mesma familia e mesma posicao no chain do gate de e-mail verificado.
     * Gateia os dois documentos obrigatorios (TERMS_OF_USE + PRIVACY_POLICY).
     */
    private readonly termsAcceptance: TermsAcceptanceLookup,
  ) {}

  /**
   * Profissional convida um paciente para UMA especialidade, declarando a
   * MODALIDADE do atendimento (D-101). Devolve o token 1x. A modalidade viaja no
   * convite porque o vinculo nasce do aceite — e nao ha vinculo sem ela.
   */
  async createInvite(
    authorization: string | undefined,
    tenantId: string,
    input: { email: string; specialtyId: string; modality: CareModality },
  ): Promise<CreatePatientInviteResult> {
    const { professionalProfileId, accountId } = await this.requireProfessionalOwningSpecialty(
      authorization,
      tenantId,
      input.specialtyId,
    );
    await requireVerifiedEmail(this.emailVerification, accountId);
    await requireCurrentTermsAcceptance(this.termsAcceptance, accountId, 'TERMS_OF_USE');
    await requireCurrentTermsAcceptance(this.termsAcceptance, accountId, 'PRIVACY_POLICY');
    const pending = await this.patients.findPendingInvite(
      tenantId,
      professionalProfileId,
      input.email,
      input.specialtyId,
    );
    if (pending) {
      throw new InvitePendingConflictError();
    }
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + this.inviteTtlSeconds * 1000);
    const invite = await this.patients.createInvite({
      tenantId,
      professionalProfileId,
      specialtyId: input.specialtyId,
      email: input.email,
      modality: input.modality,
      tokenHash: hashInviteToken(token),
      expiresAt,
    });
    return { invite: toInviteView(invite), token };
  }

  /** Profissional ve seus convites pendentes + vinculos ativos (operacional). */
  async listOverview(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<PatientOverviewResult> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const [pendingInvites, activeBonds] = await Promise.all([
      this.patients.listPendingInvites(tenantId, professionalProfileId),
      this.patients.listActiveBonds(tenantId, professionalProfileId),
    ]);
    return {
      pendingInvites: pendingInvites.map(toInviteView),
      activeBonds: activeBonds.map(toBondView),
    };
  }

  /** Profissional reenvia um convite pendente (D-055): rotaciona o token 1x. */
  async resendInvite(
    authorization: string | undefined,
    tenantId: string,
    inviteId: string,
  ): Promise<CreatePatientInviteResult> {
    const { professionalProfileId, accountId } = await this.requireProfessional(
      authorization,
      tenantId,
    );
    await requireVerifiedEmail(this.emailVerification, accountId);
    await requireCurrentTermsAcceptance(this.termsAcceptance, accountId, 'TERMS_OF_USE');
    await requireCurrentTermsAcceptance(this.termsAcceptance, accountId, 'PRIVACY_POLICY');
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + this.inviteTtlSeconds * 1000);
    const invite = await this.patients.resendInvite(
      tenantId,
      professionalProfileId,
      inviteId,
      hashInviteToken(token),
      expiresAt,
    );
    if (!invite) {
      throw new NotFoundError('Convite pendente nao encontrado.');
    }
    return { invite: toInviteView(invite), token };
  }

  /** Profissional revoga um convite pendente. */
  async revokeInvite(
    authorization: string | undefined,
    tenantId: string,
    inviteId: string,
  ): Promise<void> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const revoked = await this.patients.revokeInvite(tenantId, professionalProfileId, inviteId);
    if (!revoked) {
      throw new NotFoundError('Convite pendente nao encontrado.');
    }
  }

  /** Profissional arquiva um vinculo ativo (D-053): ACTIVE -> ARCHIVED, nunca apaga. */
  async archiveBond(
    authorization: string | undefined,
    tenantId: string,
    bondId: string,
  ): Promise<void> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const archived = await this.patients.archiveBond(tenantId, professionalProfileId, bondId);
    if (!archived) {
      throw new NotFoundError('Vinculo ativo nao encontrado.');
    }
  }

  /**
   * Paciente aceita o convite pelo token (endpoint publico — o token de uso unico
   * e a propria autorizacao). Cria a conta+perfil de paciente (se novo) OU
   * anexa/reusa o perfil na conta existente (multi-papel — D-041), e abre o
   * vinculo na especialidade do convite.
   */
  async acceptInvite(input: AcceptPatientInviteInput): Promise<AcceptPatientInviteResult> {
    const passwordHash = await this.hasher.hash(input.password);
    const outcome = await this.patients.acceptInvite(hashInviteToken(input.token), {
      passwordHash,
      name: input.name,
      document: input.document,
    });
    if (outcome.status === 'invalid') {
      throw new InvalidInviteTokenError();
    }
    if (outcome.status === 'bond-conflict') {
      throw new BondAlreadyExistsError();
    }

    // Motor de compartilhamento (D-017): o vinculo recem-aberto pode gerar uma
    // sobreposicao de profissionais para o paciente. Publicamos o evento e o
    // worker decide (deteccao + sugestao). Publicar apos o commit do aceite.
    await this.bondEvents.enqueue(BOND_CREATED_EVENT, {
      patientProfileId: outcome.patientProfileId,
      professionalProfileId: outcome.professionalProfileId,
      specialtyId: outcome.specialtyId,
      tenantId: outcome.tenantId,
    });

    return {
      patient: {
        accountId: outcome.accountId,
        tenantId: outcome.tenantId,
        patientProfileId: outcome.patientProfileId,
      },
      bond: { id: outcome.bondId, specialtyId: outcome.specialtyId },
      created: outcome.created,
    };
  }

  /**
   * Guard base: Bearer valido + a conta possui perfil profissional NESTE tenant
   * (isolamento — D-002). Retorna o id do perfil para escopar as operacoes.
   */
  private async requireProfessional(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<{ professionalProfileId: string; accountId: string }> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const professional = await this.patients.findProfessional(ctx.accountId, tenantId);
    if (!professional) {
      throw new ForbiddenError('Requer um perfil profissional neste tenant.');
    }
    return { ...professional, accountId: ctx.accountId };
  }

  /**
   * Guard do convite: alem de ser profissional do tenant, deve reivindicar a
   * especialidade-alvo (tem ProfessionalSpecialty — D-046). Regra: exigimos a
   * reivindicacao da especialidade, mas NAO bloqueamos em VERIFIED no momento do
   * convite (o gate de atendimento por verificacao — ADR-0003/D-010 — entra com
   * o fluxo de verificacao).
   * TODO(D-010): exigir verificationStatus === VERIFIED quando o fluxo de
   * verificacao existir.
   */
  private async requireProfessionalOwningSpecialty(
    authorization: string | undefined,
    tenantId: string,
    specialtyId: string,
  ): Promise<{ professionalProfileId: string; accountId: string }> {
    const professional = await this.requireProfessional(authorization, tenantId);
    const exists = await this.patients.specialtyExists(specialtyId);
    if (!exists) {
      throw new NotFoundError('Especialidade nao encontrada.');
    }
    const owns = await this.patients.professionalHasSpecialty(
      professional.professionalProfileId,
      specialtyId,
    );
    if (!owns) {
      throw new ForbiddenError('O profissional nao possui esta especialidade.');
    }
    return professional;
  }
}

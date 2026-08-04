import type { WorkoutReaction } from '@fitvo/database';
import type {
  WorkoutAdherenceQuery,
  WorkoutAdherenceView,
  WorkoutCompleteSessionInput,
  WorkoutLogSetInput,
  WorkoutRatingView,
  WorkoutSessionDetailView,
  WorkoutSessionListQuery,
  WorkoutSessionSummaryView,
  WorkoutSetLogView,
  WorkoutStartSessionInput,
} from '@fitvo/validation';

import type { AccessTokenVerifier } from '../../shared/auth-context';
import { requireAuth } from '../../shared/auth-context';
import {
  ForbiddenError,
  NotFoundError,
  SetLogForeignSetError,
  WorkoutSessionStateConflictError,
} from '../../shared/http-errors';
import { type AdherenceCheckIn, summarizeAdherence } from './workout-domain';
import type {
  SessionListFilter,
  SetLogRecord,
  WorkoutExecutionRepository,
  WorkoutRatingRecord,
  WorkoutSessionDetailRecord,
  WorkoutSessionRecord,
} from './workout-execution-repository';

function toSetLogView(log: SetLogRecord): WorkoutSetLogView {
  return {
    id: log.id,
    sessionId: log.sessionId,
    workoutSetId: log.workoutSetId,
    done: log.done,
    actualReps: log.actualReps,
    actualWeightGrams: log.actualWeightGrams,
    actualDurationSeconds: log.actualDurationSeconds,
    actualDistanceMeters: log.actualDistanceMeters,
    note: log.note,
    createdAt: log.createdAt.toISOString(),
  };
}

function toRatingView(rating: WorkoutRatingRecord): WorkoutRatingView {
  return {
    id: rating.id,
    sessionId: rating.sessionId,
    score: rating.score,
    perceivedEffort: rating.perceivedEffort,
    comment: rating.comment,
    reactions: rating.reactions,
    createdAt: rating.createdAt.toISOString(),
  };
}

function toSessionView(session: WorkoutSessionRecord): WorkoutSessionSummaryView {
  return {
    id: session.id,
    bondId: session.bondId,
    workoutId: session.workoutId,
    planId: session.planId,
    status: session.status,
    performedAt: session.performedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function toSessionDetailView(session: WorkoutSessionDetailRecord): WorkoutSessionDetailView {
  return {
    ...toSessionView(session),
    setLogs: session.setLogs.map(toSetLogView),
    rating: session.rating === null ? null : toRatingView(session.rating),
  };
}

function toListFilter(query: WorkoutSessionListQuery): SessionListFilter {
  return {
    status: query.status,
    from: query.from === undefined ? undefined : new Date(query.from),
    to: query.to === undefined ? undefined : new Date(query.to),
  };
}

function toAdherenceView(
  query: WorkoutAdherenceQuery,
  checkIns: AdherenceCheckIn[],
): WorkoutAdherenceView {
  const summary = summarizeAdherence(checkIns);
  return { from: query.from, to: query.to, ...summary };
}

/**
 * Serviço de aplicação da EXECUÇÃO de treino — Bloco 3 (ADR-0009):
 * `WorkoutSession` (D-086), `SetLog` (D-086), `WorkoutRating` (D-087) e os
 * indicadores derivados (D-092).
 *
 * A DECISÃO DE PRODUTO DESTE BLOCO É A FRICÇÃO, e ela é estrutural aqui:
 *
 * 1. CONCLUIR = CHECK-IN LEVE. `completeSession` exige a avaliação (D-086 diz
 *    "avalia o treino — obrigatório") e NADA MAIS. Não há, em nenhum ponto
 *    deste arquivo, uma verificação de quantos `SetLog` a sessão tem: concluir
 *    com zero séries registradas é o caminho NORMAL. O check-in é o sinal de
 *    PRESENÇA — o mais importante do produto, porque alimenta a aderência
 *    (D-092) e as réguas de ausência. Exigir série a série mataria a adesão e,
 *    com ela, o sinal.
 *
 * 2. CARGA REAL É INCENTIVADA, não cobrada. `logSet` é rota própria, chamável
 *    quantas vezes o aluno quiser, antes da conclusão. É o dado premium de quem
 *    engaja (D-085/D-092), não um pedágio.
 *
 * 3. ESCOPO POR VÍNCULO DO ALUNO. Quem executa é o aluno; o profissional LÊ.
 *    Não existe caminho aqui em que o profissional registre execução pelo
 *    aluno — o dado é de presença, e presença declarada por terceiro não é
 *    presença.
 *
 * 4. ADERÊNCIA RESPEITA O PLANO FIXO (D-105) reusando `planCountsTowardAdherence`
 *    via `summarizeAdherence` — o mesmo predicado que o Bloco 2 expõe em
 *    `countsTowardAdherence`. Este serviço NÃO reinterpreta `isFixed`.
 *
 * Fora de escopo (blocos próprios): card visual compartilhável, progressão
 * sugerida (D-167), análise de forma por IA (D-088) e o sync offline (D-099).
 */
export class WorkoutExecutionApplicationService {
  constructor(
    private readonly executions: WorkoutExecutionRepository,
    private readonly tokenVerifier: AccessTokenVerifier,
  ) {}

  // ---- Superfície do ALUNO --------------------------------------------------

  /**
   * D-086 — abre a sessão do treino. Nasce IN_PROGRESS porque a execução começa
   * no device e pode ficar pendente até sincronizar (D-099).
   *
   * NÃO há trava de "uma sessão aberta por treino": o aluno que abandonou o app
   * no meio e voltou no dia seguinte teria o caminho bloqueado por uma sessão
   * fantasma, e o enum sequer tem estado de abandono para fechá-la. Sessão
   * aberta que nunca conclui não conta como check-in — logo, não polui indicador.
   */
  async startSession(
    authorization: string | undefined,
    workoutId: string,
    input: WorkoutStartSessionInput,
  ): Promise<WorkoutSessionSummaryView> {
    const { patientProfileId } = await this.requirePatient(authorization);
    const workout = await this.executions.findExecutableWorkout(patientProfileId, workoutId);
    if (!workout) {
      throw new NotFoundError('Treino nao encontrado.');
    }

    const session = await this.executions.startSession({
      tenantId: workout.tenantId,
      bondId: workout.bondId,
      workoutId: workout.workoutId,
      planId: workout.planId,
      performedAt: input.performedAt === undefined ? new Date() : new Date(input.performedAt),
    });
    return toSessionView(session);
  }

  /**
   * D-086 — registro OPCIONAL da carga real. Só entra em sessão ainda aberta:
   * depois do check-in a sessão é histórico (D-100), e histórico que recebe
   * linha nova depois de fechado não é histórico.
   */
  async logSet(
    authorization: string | undefined,
    sessionId: string,
    input: WorkoutLogSetInput,
  ): Promise<WorkoutSetLogView> {
    const { patientProfileId } = await this.requirePatient(authorization);
    const session = await this.executions.findSessionForPatient(patientProfileId, sessionId);
    if (!session) {
      throw new NotFoundError('Sessao de treino nao encontrada.');
    }
    if (session.status !== 'IN_PROGRESS') {
      throw new WorkoutSessionStateConflictError(
        'Esta sessao ja foi concluida; nao aceita registro de serie novo (D-100).',
      );
    }

    const log = await this.executions.createSetLog(patientProfileId, sessionId, {
      workoutSetId: input.workoutSetId ?? null,
      // Ausente = feita: quem está registrando a série está dizendo que treinou.
      done: input.done ?? true,
      actualReps: input.actualReps ?? null,
      actualWeightGrams: input.actualWeightGrams ?? null,
      actualDurationSeconds: input.actualDurationSeconds ?? null,
      actualDistanceMeters: input.actualDistanceMeters ?? null,
      note: input.note ?? null,
    });
    if (log === null) {
      throw new NotFoundError('Sessao de treino nao encontrada.');
    }
    if (log === 'FOREIGN_SET') {
      throw new SetLogForeignSetError();
    }
    return toSetLogView(log);
  }

  /**
   * D-086 — CHECK-IN: conclui a sessão. A avaliação (D-087) vem no corpo e é
   * obrigatória pelo CONTRATO, não por um `if` daqui: o Zod recusa o corpo sem
   * `rating` antes de o serviço rodar. Não existe caminho que produza uma
   * sessão COMPLETED sem avaliação — o repositório grava as duas coisas na
   * mesma transação.
   *
   * O que este método deliberadamente NÃO faz: contar `SetLog`. Ver o cabeçalho
   * da classe — é a decisão de produto, não uma pendência.
   */
  async completeSession(
    authorization: string | undefined,
    sessionId: string,
    input: WorkoutCompleteSessionInput,
  ): Promise<WorkoutSessionDetailView> {
    const { patientProfileId } = await this.requirePatient(authorization);
    const session = await this.executions.findSessionForPatient(patientProfileId, sessionId);
    if (!session) {
      throw new NotFoundError('Sessao de treino nao encontrada.');
    }
    if (session.status !== 'IN_PROGRESS') {
      // Concluir duas vezes contaria o mesmo treino duas vezes na aderência
      // (D-092) e tentaria criar uma segunda avaliação para a mesma sessão, o
      // que o `@unique` do D-087 proíbe.
      throw new WorkoutSessionStateConflictError(
        'Esta sessao ja foi concluida — o check-in acontece uma vez (D-086).',
      );
    }

    const completed = await this.executions.completeSession(patientProfileId, sessionId, {
      completedAt: new Date(),
      rating: {
        score: input.rating.score,
        perceivedEffort: input.rating.perceivedEffort,
        comment: input.rating.comment ?? null,
        reactions: (input.rating.reactions ?? []) as WorkoutReaction[],
      },
    });
    if (!completed) {
      // Perdeu a corrida com outra conclusão da mesma sessão entre a leitura e
      // a escrita. O estado final é o mesmo (concluída uma vez), e o cliente
      // precisa saber que ESTE pedido não foi o que fechou.
      throw new WorkoutSessionStateConflictError(
        'Esta sessao ja foi concluida — o check-in acontece uma vez (D-086).',
      );
    }
    return toSessionDetailView(completed);
  }

  async getMySession(
    authorization: string | undefined,
    sessionId: string,
  ): Promise<WorkoutSessionDetailView> {
    const { patientProfileId } = await this.requirePatient(authorization);
    const session = await this.executions.findSessionDetailForPatient(patientProfileId, sessionId);
    if (!session) {
      throw new NotFoundError('Sessao de treino nao encontrada.');
    }
    return toSessionDetailView(session);
  }

  async listMySessions(
    authorization: string | undefined,
    query: WorkoutSessionListQuery,
  ): Promise<WorkoutSessionSummaryView[]> {
    const { patientProfileId } = await this.requirePatient(authorization);
    const sessions = await this.executions.listSessionsForPatient(
      patientProfileId,
      toListFilter(query),
    );
    return sessions.map(toSessionView);
  }

  /** D-092 — indicadores do próprio aluno, derivados dos check-ins do período. */
  async getMyAdherence(
    authorization: string | undefined,
    query: WorkoutAdherenceQuery,
  ): Promise<WorkoutAdherenceView> {
    const { patientProfileId } = await this.requirePatient(authorization);
    const checkIns = await this.executions.listAdherenceCheckInsForPatient(
      patientProfileId,
      new Date(query.from),
      new Date(query.to),
    );
    return toAdherenceView(query, checkIns);
  }

  // ---- Superfície do PROFISSIONAL (só leitura) ------------------------------

  /**
   * D-092 — o profissional ACOMPANHA a execução do aluno. Só leitura, sem
   * exceção: não há neste serviço um caminho em que o profissional conclua uma
   * sessão ou registre carga pelo aluno.
   */
  async listBondSessions(
    authorization: string | undefined,
    tenantId: string,
    bondId: string,
    query: WorkoutSessionListQuery,
  ): Promise<WorkoutSessionSummaryView[]> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const sessions = await this.executions.listSessionsForBond(
      tenantId,
      professionalProfileId,
      bondId,
      toListFilter(query),
    );
    if (!sessions) {
      throw new NotFoundError('Vinculo nao encontrado.');
    }
    return sessions.map(toSessionView);
  }

  async getBondSession(
    authorization: string | undefined,
    tenantId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const session = await this.executions.findSessionDetailForProfessional(
      tenantId,
      professionalProfileId,
      sessionId,
    );
    if (!session) {
      throw new NotFoundError('Sessao de treino nao encontrada.');
    }
    return toSessionDetailView(session);
  }

  async getBondAdherence(
    authorization: string | undefined,
    tenantId: string,
    bondId: string,
    query: WorkoutAdherenceQuery,
  ): Promise<WorkoutAdherenceView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const checkIns = await this.executions.listAdherenceCheckInsForBond(
      tenantId,
      professionalProfileId,
      bondId,
      new Date(query.from),
      new Date(query.to),
    );
    if (!checkIns) {
      throw new NotFoundError('Vinculo nao encontrado.');
    }
    return toAdherenceView(query, checkIns);
  }

  // ---- Guards ---------------------------------------------------------------

  /** Guard do ALUNO: Bearer válido + perfil de paciente. O vínculo diz o tenant. */
  private async requirePatient(
    authorization: string | undefined,
  ): Promise<{ patientProfileId: string }> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const patient = await this.executions.findPatientProfile(ctx.accountId);
    if (!patient) {
      throw new ForbiddenError('Requer um perfil de paciente.');
    }
    return patient;
  }

  /** Guard da LEITURA do profissional: perfil profissional NESTE tenant (D-002). */
  private async requireProfessional(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<{ professionalProfileId: string }> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const professional = await this.executions.findProfessional(ctx.accountId, tenantId);
    if (!professional) {
      throw new ForbiddenError('Requer um perfil profissional neste tenant.');
    }
    return professional;
  }
}

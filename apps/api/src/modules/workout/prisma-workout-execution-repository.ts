import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import type {
  AdherenceCheckInRecord,
  CompleteSessionInput,
  CreateSetLogInput,
  ExecutableWorkoutRecord,
  SessionListFilter,
  SetLogRecord,
  WorkoutExecutionRepository,
  WorkoutSessionDetailRecord,
  WorkoutSessionRecord,
} from './workout-execution-repository';

/** Tombstone (D-089/D-099): o que foi apagado logicamente nunca volta na leitura. */
const LIVE = { deletedAt: null } as const;

const SESSION_PROJECTION = {
  id: true,
  bondId: true,
  workoutId: true,
  planId: true,
  status: true,
  performedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SET_LOG_PROJECTION = {
  id: true,
  sessionId: true,
  workoutSetId: true,
  done: true,
  actualReps: true,
  actualWeightGrams: true,
  actualDurationSeconds: true,
  actualDistanceMeters: true,
  note: true,
  createdAt: true,
} as const;

const RATING_PROJECTION = {
  id: true,
  sessionId: true,
  score: true,
  perceivedEffort: true,
  comment: true,
  reactions: true,
  createdAt: true,
} as const;

const SESSION_DETAIL_PROJECTION = {
  ...SESSION_PROJECTION,
  setLogs: { where: LIVE, select: SET_LOG_PROJECTION, orderBy: { createdAt: 'asc' } },
  rating: { where: LIVE, select: RATING_PROJECTION },
} as const;

/**
 * O `isFixed` vem do PLANO, alcançado pelo treino da sessão — nunca de uma
 * cópia na execução. `WorkoutSession` carrega `planId` denormalizado para a
 * linha do tempo (D-092), mas não tem relação com o plano: quem tem é o
 * `Workout`. Uma coluna "esta sessão conta" divergiria do plano no dia em que o
 * profissional trocasse `isFixed` — e o D-105 é derivado justamente para não
 * existirem duas respostas.
 */
const PLAN_FIXED_PROJECTION = { select: { isFixed: true } } as const;

function toCheckIn(session: {
  planId: string;
  performedAt: Date;
  workout: { plan: { isFixed: boolean } };
}): AdherenceCheckInRecord {
  return {
    planId: session.planId,
    planIsFixed: session.workout.plan.isFixed,
    performedAt: session.performedAt,
  };
}

/** Janela por `performedAt` — o eixo dos indicadores (D-092), sempre em UTC (D-067). */
function performedAtWindow(filter: SessionListFilter): { gte?: Date; lte?: Date } | undefined {
  if (filter.from === undefined && filter.to === undefined) {
    return undefined;
  }
  return {
    ...(filter.from === undefined ? {} : { gte: filter.from }),
    ...(filter.to === undefined ? {} : { lte: filter.to }),
  };
}

/**
 * Implementação Prisma (infra) da EXECUÇÃO de treino — Bloco 3 (ADR-0009).
 *
 * TODO PREDICADO CARREGA O EIXO DA SUPERFÍCIE, sem exceção:
 * - aluno: `bond: { patientProfileId }` — quem executa é o dono do vínculo;
 * - profissional: `tenantId` + `bond: { professionalProfileId }`, igual ao
 *   Bloco 2, e só em leitura.
 *
 * O `tenantId` denormalizado que o #131 retrofitou nestas tabelas é defesa em
 * profundidade (D-166/ADR-0017): a extension de isolamento injeta o filtro
 * mesmo que o dev esqueça. Ele NÃO substitui o eixo do vínculo — um tenant
 * inteiro de alunos compartilha o mesmo `tenantId`, e é o vínculo que diz de
 * quem é aquela execução.
 *
 * NENHUMA consulta por id puro: até a releitura pós-escrita só roda depois de
 * um predicado escopado ter confirmado que a linha é do chamador.
 */
export class PrismaWorkoutExecutionRepository implements WorkoutExecutionRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async findPatientProfile(accountId: string): Promise<{ patientProfileId: string } | null> {
    const profile = await this.db.patientProfile.findFirst({
      where: { accountId },
      select: { id: true },
    });
    return profile ? { patientProfileId: profile.id } : null;
  }

  async findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null> {
    const profile = await this.db.professionalProfile.findFirst({
      where: { accountId, tenantId },
      select: { id: true },
    });
    return profile ? { professionalProfileId: profile.id } : null;
  }

  async findExecutableWorkout(
    patientProfileId: string,
    workoutId: string,
  ): Promise<ExecutableWorkoutRecord | null> {
    const workout = await this.db.workout.findFirst({
      where: {
        id: workoutId,
        ...LIVE,
        bond: { patientProfileId },
        // D-165 na CLÁUSULA: o aluno nunca executa rascunho, pela mesma razão
        // de nunca vê-lo em `/me/plans` — plano em montagem não existe para
        // quem vai treinar.
        plan: { ...LIVE, status: { not: 'DRAFT' } },
      },
      select: { id: true, tenantId: true, bondId: true, planId: true },
    });
    return workout
      ? {
          workoutId: workout.id,
          tenantId: workout.tenantId,
          bondId: workout.bondId,
          planId: workout.planId,
        }
      : null;
  }

  startSession(input: {
    tenantId: string;
    bondId: string;
    workoutId: string;
    planId: string;
    performedAt: Date;
  }): Promise<WorkoutSessionRecord> {
    return this.db.workoutSession.create({
      data: {
        tenantId: input.tenantId,
        bondId: input.bondId,
        workoutId: input.workoutId,
        planId: input.planId,
        performedAt: input.performedAt,
        // `status` fica no default IN_PROGRESS: a sessão nasce aberta e só o
        // check-in a fecha (D-086).
      },
      select: SESSION_PROJECTION,
    });
  }

  findSessionForPatient(
    patientProfileId: string,
    sessionId: string,
  ): Promise<WorkoutSessionRecord | null> {
    return this.db.workoutSession.findFirst({
      where: { id: sessionId, ...LIVE, bond: { patientProfileId } },
      select: SESSION_PROJECTION,
    });
  }

  findSessionDetailForPatient(
    patientProfileId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailRecord | null> {
    return this.db.workoutSession.findFirst({
      where: { id: sessionId, ...LIVE, bond: { patientProfileId } },
      select: SESSION_DETAIL_PROJECTION,
    });
  }

  findSessionDetailForProfessional(
    tenantId: string,
    professionalProfileId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailRecord | null> {
    return this.db.workoutSession.findFirst({
      where: { id: sessionId, tenantId, ...LIVE, bond: { tenantId, professionalProfileId } },
      select: SESSION_DETAIL_PROJECTION,
    });
  }

  listSessionsForPatient(
    patientProfileId: string,
    filter: SessionListFilter,
  ): Promise<WorkoutSessionRecord[]> {
    const performedAt = performedAtWindow(filter);
    return this.db.workoutSession.findMany({
      where: {
        ...LIVE,
        bond: { patientProfileId },
        ...(filter.status === undefined ? {} : { status: filter.status }),
        ...(performedAt === undefined ? {} : { performedAt }),
      },
      select: SESSION_PROJECTION,
      orderBy: { performedAt: 'desc' },
    });
  }

  async listSessionsForBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
    filter: SessionListFilter,
  ): Promise<WorkoutSessionRecord[] | null> {
    const bond = await this.db.bond.findFirst({
      where: { id: bondId, tenantId, professionalProfileId },
      select: { id: true },
    });
    if (!bond) {
      return null;
    }
    const performedAt = performedAtWindow(filter);
    return this.db.workoutSession.findMany({
      where: {
        tenantId,
        bondId,
        ...LIVE,
        bond: { tenantId, professionalProfileId },
        ...(filter.status === undefined ? {} : { status: filter.status }),
        ...(performedAt === undefined ? {} : { performedAt }),
      },
      select: SESSION_PROJECTION,
      orderBy: { performedAt: 'desc' },
    });
  }

  async createSetLog(
    patientProfileId: string,
    sessionId: string,
    input: CreateSetLogInput,
  ): Promise<SetLogRecord | null | 'FOREIGN_SET'> {
    const session = await this.db.workoutSession.findFirst({
      where: { id: sessionId, ...LIVE, bond: { patientProfileId } },
      select: { id: true, tenantId: true, workoutId: true },
    });
    if (!session) {
      return null;
    }

    if (input.workoutSetId !== null) {
      // A série prescrita tem de ser do MESMO treino desta sessão — verificado
      // pelo caminho `workoutItem.workoutId`, não pelo id solto. Sem isso, um
      // id adivinhado ligaria a execução deste aluno à prescrição de outro.
      const set = await this.db.workoutSet.findFirst({
        where: {
          id: input.workoutSetId,
          ...LIVE,
          workoutItem: { ...LIVE, workoutId: session.workoutId },
        },
        select: { id: true },
      });
      if (!set) {
        return 'FOREIGN_SET';
      }
    }

    return this.db.setLog.create({
      data: {
        tenantId: session.tenantId,
        sessionId: session.id,
        workoutSetId: input.workoutSetId,
        done: input.done,
        actualReps: input.actualReps,
        actualWeightGrams: input.actualWeightGrams,
        actualDurationSeconds: input.actualDurationSeconds,
        actualDistanceMeters: input.actualDistanceMeters,
        note: input.note,
      },
      select: SET_LOG_PROJECTION,
    });
  }

  /**
   * CHECK-IN (D-086) — status + `completedAt` + avaliação numa transação só.
   *
   * O `updateMany` escopado é o que autoriza: ele só alcança a sessão se ela
   * for do aluno E ainda estiver IN_PROGRESS. Contagem zero significa "não é
   * sua, não existe, ou já foi concluída" — os três viram `null` aqui, e o
   * service decide o código HTTP consultando o estado atual. É o mesmo motivo
   * de o rating não ser criado antes: se a sessão não muda de estado, a
   * avaliação não deve existir.
   *
   * NENHUMA verificação de `SetLog`: concluir sem série registrada é o caminho
   * NORMAL, não a exceção.
   */
  async completeSession(
    patientProfileId: string,
    sessionId: string,
    input: CompleteSessionInput,
  ): Promise<WorkoutSessionDetailRecord | null> {
    const session = await this.db.workoutSession.findFirst({
      where: { id: sessionId, ...LIVE, bond: { patientProfileId } },
      select: { id: true, tenantId: true },
    });
    if (!session) {
      return null;
    }

    const completed = await this.db.$transaction(async (tx) => {
      const updated = await tx.workoutSession.updateMany({
        where: { id: session.id, tenantId: session.tenantId, ...LIVE, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', completedAt: input.completedAt },
      });
      if (updated.count === 0) {
        return false;
      }
      // A unicidade de `sessionId` em `workout_rating` é do BANCO (D-087): duas
      // conclusões concorrentes não produzem duas avaliações nem que passem
      // pelo `updateMany` juntas — a segunda quebra a constraint e a transação
      // inteira volta atrás.
      await tx.workoutRating.create({
        data: {
          tenantId: session.tenantId,
          sessionId: session.id,
          score: input.rating.score,
          perceivedEffort: input.rating.perceivedEffort,
          comment: input.rating.comment,
          reactions: input.rating.reactions,
        },
      });
      return true;
    });

    if (!completed) {
      return null;
    }
    return this.findSessionDetailForPatient(patientProfileId, sessionId);
  }

  async listAdherenceCheckInsForPatient(
    patientProfileId: string,
    from: Date,
    to: Date,
  ): Promise<AdherenceCheckInRecord[]> {
    const sessions = await this.db.workoutSession.findMany({
      where: {
        ...LIVE,
        bond: { patientProfileId },
        status: 'COMPLETED',
        performedAt: { gte: from, lte: to },
      },
      select: {
        planId: true,
        performedAt: true,
        workout: { select: { plan: PLAN_FIXED_PROJECTION } },
      },
      orderBy: { performedAt: 'asc' },
    });
    return sessions.map(toCheckIn);
  }

  async listAdherenceCheckInsForBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
    from: Date,
    to: Date,
  ): Promise<AdherenceCheckInRecord[] | null> {
    const bond = await this.db.bond.findFirst({
      where: { id: bondId, tenantId, professionalProfileId },
      select: { id: true },
    });
    if (!bond) {
      return null;
    }
    const sessions = await this.db.workoutSession.findMany({
      where: {
        tenantId,
        bondId,
        ...LIVE,
        bond: { tenantId, professionalProfileId },
        status: 'COMPLETED',
        performedAt: { gte: from, lte: to },
      },
      select: {
        planId: true,
        performedAt: true,
        workout: { select: { plan: PLAN_FIXED_PROJECTION } },
      },
      orderBy: { performedAt: 'asc' },
    });
    return sessions.map(toCheckIn);
  }
}

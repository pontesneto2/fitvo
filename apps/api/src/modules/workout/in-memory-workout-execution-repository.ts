import type { WorkoutSessionStatus } from '@fitvo/database';

import type {
  AdherenceCheckInRecord,
  CompleteSessionInput,
  CreateSetLogInput,
  ExecutableWorkoutRecord,
  SessionListFilter,
  SetLogRecord,
  WorkoutExecutionRepository,
  WorkoutRatingRecord,
  WorkoutSessionDetailRecord,
  WorkoutSessionRecord,
} from './workout-execution-repository';

interface StoredProfessional {
  id: string;
  accountId: string;
  tenantId: string;
}

interface StoredPatient {
  id: string;
  accountId: string;
}

interface StoredBond {
  id: string;
  tenantId: string;
  professionalProfileId: string;
  patientProfileId: string;
}

interface StoredWorkout {
  id: string;
  tenantId: string;
  bondId: string;
  planId: string;
  planStatus: 'DRAFT' | 'ACTIVE';
  planIsFixed: boolean;
  /** Séries prescritas do treino — o que um `workoutSetId` de log pode apontar. */
  setIds: string[];
}

interface StoredSession {
  id: string;
  tenantId: string;
  bondId: string;
  workoutId: string;
  planId: string;
  status: WorkoutSessionStatus;
  performedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Double in-memory da EXECUÇÃO de treino (ADR-0009, Bloco 3). Reproduz as
 * REGRAS — escopo pelo vínculo do aluno, escopo tenant+profissional na leitura,
 * unicidade da avaliação por sessão e a recusa de concluir duas vezes — para
 * que o teste de fluxo HTTP rode sem Postgres.
 *
 * O que ele NÃO substitui: o teste de integração. Escopo e unicidade são
 * afirmações sobre cláusula SQL e constraint, e nenhuma das duas roda aqui.
 */
export class InMemoryWorkoutExecutionRepository implements WorkoutExecutionRepository {
  private readonly professionals = new Map<string, StoredProfessional>();
  private readonly patients = new Map<string, StoredPatient>();
  private readonly bonds = new Map<string, StoredBond>();
  private readonly workouts = new Map<string, StoredWorkout>();
  private readonly sessions = new Map<string, StoredSession>();
  private readonly setLogs = new Map<string, SetLogRecord>();
  private readonly ratings = new Map<string, WorkoutRatingRecord>();
  private sequence = 0;

  // ---- Seeds de arranjo -----------------------------------------------------

  seedProfessional(input: { accountId: string; tenantId: string }): string {
    const id = this.nextId('pro');
    this.professionals.set(id, { id, ...input });
    return id;
  }

  seedPatient(input: { accountId: string }): string {
    const id = this.nextId('pat');
    this.patients.set(id, { id, ...input });
    return id;
  }

  seedBond(input: {
    tenantId: string;
    professionalProfileId: string;
    patientProfileId: string;
  }): string {
    const id = this.nextId('bond');
    this.bonds.set(id, { id, ...input });
    return id;
  }

  /** Treino prescrito pronto para ser executado; `setIds` são as séries do treino. */
  seedWorkout(input: {
    bondId: string;
    planId?: string | undefined;
    planStatus?: 'DRAFT' | 'ACTIVE' | undefined;
    planIsFixed?: boolean | undefined;
    setIds?: string[] | undefined;
  }): string {
    const bond = this.bonds.get(input.bondId);
    if (!bond) {
      throw new Error(`Vinculo ${input.bondId} nao semeado.`);
    }
    const id = this.nextId('wk');
    this.workouts.set(id, {
      id,
      tenantId: bond.tenantId,
      bondId: bond.id,
      planId: input.planId ?? this.nextId('plan'),
      planStatus: input.planStatus ?? 'ACTIVE',
      planIsFixed: input.planIsFixed ?? false,
      setIds: input.setIds ?? [],
    });
    return id;
  }

  // ---- Porta ----------------------------------------------------------------

  findPatientProfile(accountId: string): Promise<{ patientProfileId: string } | null> {
    const found = [...this.patients.values()].find((patient) => patient.accountId === accountId);
    return Promise.resolve(found ? { patientProfileId: found.id } : null);
  }

  findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null> {
    const found = [...this.professionals.values()].find(
      (professional) => professional.accountId === accountId && professional.tenantId === tenantId,
    );
    return Promise.resolve(found ? { professionalProfileId: found.id } : null);
  }

  findExecutableWorkout(
    patientProfileId: string,
    workoutId: string,
  ): Promise<ExecutableWorkoutRecord | null> {
    const workout = this.workouts.get(workoutId);
    if (!workout || workout.planStatus === 'DRAFT') {
      return Promise.resolve(null);
    }
    const bond = this.bonds.get(workout.bondId);
    if (!bond || bond.patientProfileId !== patientProfileId) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      workoutId: workout.id,
      tenantId: workout.tenantId,
      bondId: workout.bondId,
      planId: workout.planId,
    });
  }

  startSession(input: {
    tenantId: string;
    bondId: string;
    workoutId: string;
    planId: string;
    performedAt: Date;
  }): Promise<WorkoutSessionRecord> {
    const id = this.nextId('sess');
    const now = new Date();
    const session: StoredSession = {
      id,
      tenantId: input.tenantId,
      bondId: input.bondId,
      workoutId: input.workoutId,
      planId: input.planId,
      status: 'IN_PROGRESS',
      performedAt: input.performedAt,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, session);
    return Promise.resolve(toSessionRecord(session));
  }

  findSessionForPatient(
    patientProfileId: string,
    sessionId: string,
  ): Promise<WorkoutSessionRecord | null> {
    const session = this.ownedByPatient(patientProfileId, sessionId);
    return Promise.resolve(session ? toSessionRecord(session) : null);
  }

  findSessionDetailForPatient(
    patientProfileId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailRecord | null> {
    const session = this.ownedByPatient(patientProfileId, sessionId);
    return Promise.resolve(session ? this.toDetail(session) : null);
  }

  findSessionDetailForProfessional(
    tenantId: string,
    professionalProfileId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailRecord | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      return Promise.resolve(null);
    }
    const bond = this.bonds.get(session.bondId);
    if (!bond || bond.professionalProfileId !== professionalProfileId) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.toDetail(session));
  }

  listSessionsForPatient(
    patientProfileId: string,
    filter: SessionListFilter,
  ): Promise<WorkoutSessionRecord[]> {
    const sessions = [...this.sessions.values()]
      .filter((session) => this.bonds.get(session.bondId)?.patientProfileId === patientProfileId)
      .filter((session) => matchesFilter(session, filter))
      .sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime())
      .map(toSessionRecord);
    return Promise.resolve(sessions);
  }

  listSessionsForBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
    filter: SessionListFilter,
  ): Promise<WorkoutSessionRecord[] | null> {
    const bond = this.bonds.get(bondId);
    if (
      !bond ||
      bond.tenantId !== tenantId ||
      bond.professionalProfileId !== professionalProfileId
    ) {
      return Promise.resolve(null);
    }
    const sessions = [...this.sessions.values()]
      .filter((session) => session.bondId === bondId)
      .filter((session) => matchesFilter(session, filter))
      .sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime())
      .map(toSessionRecord);
    return Promise.resolve(sessions);
  }

  createSetLog(
    patientProfileId: string,
    sessionId: string,
    input: CreateSetLogInput,
  ): Promise<SetLogRecord | null | 'FOREIGN_SET'> {
    const session = this.ownedByPatient(patientProfileId, sessionId);
    if (!session) {
      return Promise.resolve(null);
    }
    if (input.workoutSetId !== null) {
      const workout = this.workouts.get(session.workoutId);
      if (!workout?.setIds.includes(input.workoutSetId)) {
        return Promise.resolve('FOREIGN_SET');
      }
    }
    const log: SetLogRecord = {
      id: this.nextId('log'),
      sessionId: session.id,
      workoutSetId: input.workoutSetId,
      done: input.done,
      actualReps: input.actualReps,
      actualWeightGrams: input.actualWeightGrams,
      actualDurationSeconds: input.actualDurationSeconds,
      actualDistanceMeters: input.actualDistanceMeters,
      note: input.note,
      createdAt: new Date(),
    };
    this.setLogs.set(log.id, log);
    return Promise.resolve(log);
  }

  completeSession(
    patientProfileId: string,
    sessionId: string,
    input: CompleteSessionInput,
  ): Promise<WorkoutSessionDetailRecord | null> {
    const session = this.ownedByPatient(patientProfileId, sessionId);
    // Sessão já concluída devolve `null` como no Prisma (o `updateMany` não a
    // alcança): quem traduz para 409 é o service, olhando o estado atual.
    if (!session || session.status !== 'IN_PROGRESS') {
      return Promise.resolve(null);
    }
    session.status = 'COMPLETED';
    session.completedAt = input.completedAt;
    session.updatedAt = new Date();

    const rating: WorkoutRatingRecord = {
      id: this.nextId('rat'),
      sessionId: session.id,
      score: input.rating.score,
      perceivedEffort: input.rating.perceivedEffort,
      comment: input.rating.comment,
      reactions: input.rating.reactions,
      createdAt: new Date(),
    };
    this.ratings.set(session.id, rating);
    return Promise.resolve(this.toDetail(session));
  }

  listAdherenceCheckInsForPatient(
    patientProfileId: string,
    from: Date,
    to: Date,
  ): Promise<AdherenceCheckInRecord[]> {
    const checkIns = [...this.sessions.values()]
      .filter((session) => this.bonds.get(session.bondId)?.patientProfileId === patientProfileId)
      .filter((session) => isCheckInWithin(session, from, to))
      .map((session) => this.toCheckIn(session));
    return Promise.resolve(checkIns);
  }

  listAdherenceCheckInsForBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
    from: Date,
    to: Date,
  ): Promise<AdherenceCheckInRecord[] | null> {
    const bond = this.bonds.get(bondId);
    if (
      !bond ||
      bond.tenantId !== tenantId ||
      bond.professionalProfileId !== professionalProfileId
    ) {
      return Promise.resolve(null);
    }
    const checkIns = [...this.sessions.values()]
      .filter((session) => session.bondId === bondId)
      .filter((session) => isCheckInWithin(session, from, to))
      .map((session) => this.toCheckIn(session));
    return Promise.resolve(checkIns);
  }

  // ---- Interno --------------------------------------------------------------

  private ownedByPatient(patientProfileId: string, sessionId: string): StoredSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    const bond = this.bonds.get(session.bondId);
    return bond?.patientProfileId === patientProfileId ? session : null;
  }

  private toDetail(session: StoredSession): WorkoutSessionDetailRecord {
    return {
      ...toSessionRecord(session),
      setLogs: [...this.setLogs.values()]
        .filter((log) => log.sessionId === session.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
      rating: this.ratings.get(session.id) ?? null,
    };
  }

  private toCheckIn(session: StoredSession): AdherenceCheckInRecord {
    return {
      planId: session.planId,
      // Vem do PLANO do treino, nunca de uma cópia na sessão — mesma origem do
      // repositório Prisma (D-105).
      planIsFixed: this.workouts.get(session.workoutId)?.planIsFixed ?? false,
      performedAt: session.performedAt,
    };
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }
}

function toSessionRecord(session: StoredSession): WorkoutSessionRecord {
  return {
    id: session.id,
    bondId: session.bondId,
    workoutId: session.workoutId,
    planId: session.planId,
    status: session.status,
    performedAt: session.performedAt,
    completedAt: session.completedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function matchesFilter(session: StoredSession, filter: SessionListFilter): boolean {
  if (filter.status !== undefined && session.status !== filter.status) {
    return false;
  }
  if (filter.from !== undefined && session.performedAt.getTime() < filter.from.getTime()) {
    return false;
  }
  return !(filter.to !== undefined && session.performedAt.getTime() > filter.to.getTime());
}

function isCheckInWithin(session: StoredSession, from: Date, to: Date): boolean {
  return (
    session.status === 'COMPLETED' &&
    session.performedAt.getTime() >= from.getTime() &&
    session.performedAt.getTime() <= to.getTime()
  );
}

import type { WorkoutReaction, WorkoutSessionStatus } from '@fitvo/database';

/** Sessão sem os filhos — a linha do tempo do aluno não carrega série a série. */
export interface WorkoutSessionRecord {
  id: string;
  bondId: string;
  workoutId: string;
  planId: string;
  status: WorkoutSessionStatus;
  performedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SetLogRecord {
  id: string;
  sessionId: string;
  workoutSetId: string | null;
  done: boolean;
  actualReps: number | null;
  actualWeightGrams: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
  note: string | null;
  createdAt: Date;
}

export interface WorkoutRatingRecord {
  id: string;
  sessionId: string;
  score: number;
  perceivedEffort: number;
  comment: string | null;
  reactions: WorkoutReaction[];
  createdAt: Date;
}

export interface WorkoutSessionDetailRecord extends WorkoutSessionRecord {
  setLogs: SetLogRecord[];
  rating: WorkoutRatingRecord | null;
}

/** O treino que o aluno pode executar + o tenant/vínculo/plano a que pertence. */
export interface ExecutableWorkoutRecord {
  workoutId: string;
  tenantId: string;
  bondId: string;
  planId: string;
}

export interface CreateSetLogInput {
  workoutSetId: string | null;
  done: boolean;
  actualReps: number | null;
  actualWeightGrams: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
  note: string | null;
}

export interface CompleteSessionInput {
  completedAt: Date;
  rating: {
    score: number;
    perceivedEffort: number;
    comment: string | null;
    reactions: WorkoutReaction[];
  };
}

export interface SessionListFilter {
  status?: WorkoutSessionStatus | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

/** Um check-in cru do período — o insumo de `summarizeAdherence` (D-092). */
export interface AdherenceCheckInRecord {
  planId: string;
  planIsFixed: boolean;
  performedAt: Date;
}

/**
 * Porta de persistência da EXECUÇÃO de treino — Bloco 3 (ADR-0009).
 *
 * DOIS EIXOS DE ESCOPO, e eles diferem por SUPERFÍCIE — é a diferença central
 * em relação ao Bloco 2:
 *
 * - ALUNO (`...ForPatient`): escopo por `patientProfileId` do vínculo. Quem
 *   executa é o aluno, e ele é a PESSOA — não há `tenantId` de path para
 *   confiar, porque o vínculo é que diz em que tenant aquela sessão vive.
 * - PROFISSIONAL (`...ForProfessional`): escopo por `tenantId` + o
 *   `professionalProfileId` dono do vínculo, igual ao Bloco 2. É LEITURA: o
 *   profissional acompanha, não executa pelo aluno.
 *
 * `null`/`false` de retorno = inexistente OU fora do escopo do chamador. O
 * service traduz os dois para 404: dizer "existe, mas não é seu" já vaza a
 * existência da execução de outro paciente.
 */
export interface WorkoutExecutionRepository {
  /** Perfil de paciente do chamador (superfície do ALUNO — sem tenant no path). */
  findPatientProfile(accountId: string): Promise<{ patientProfileId: string } | null>;

  /** Perfil profissional do chamador NESTE tenant (base do guard de leitura — D-002). */
  findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null>;

  /**
   * O treino existe, é de um vínculo DESTE aluno e o plano está visível para
   * ele? A visibilidade é a MESMA cláusula do D-165 usada em `/me/plans`
   * (`status != DRAFT`): plano em montagem não existe para quem vai executar, e
   * uma regra de visibilidade que depende de o chamador lembrar de aplicá-la
   * não é uma regra de visibilidade.
   */
  findExecutableWorkout(
    patientProfileId: string,
    workoutId: string,
  ): Promise<ExecutableWorkoutRecord | null>;

  startSession(input: {
    tenantId: string;
    bondId: string;
    workoutId: string;
    planId: string;
    performedAt: Date;
  }): Promise<WorkoutSessionRecord>;

  /** Sessão do aluno, com o `status` para o service decidir o que é permitido. */
  findSessionForPatient(
    patientProfileId: string,
    sessionId: string,
  ): Promise<WorkoutSessionRecord | null>;

  findSessionDetailForPatient(
    patientProfileId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailRecord | null>;

  findSessionDetailForProfessional(
    tenantId: string,
    professionalProfileId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailRecord | null>;

  listSessionsForPatient(
    patientProfileId: string,
    filter: SessionListFilter,
  ): Promise<WorkoutSessionRecord[]>;

  /** `null` = vínculo inexistente ou de outro profissional (vira 404 no service). */
  listSessionsForBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
    filter: SessionListFilter,
  ): Promise<WorkoutSessionRecord[] | null>;

  /**
   * Registro de carga real (D-086). Só a sessão do próprio aluno aceita log —
   * e a série prescrita, quando informada, tem de ser do MESMO treino da
   * sessão: sem isso, `workoutSetId` viraria um ponteiro para a prescrição de
   * outro paciente. `null` = sessão fora do escopo; `'FOREIGN_SET'` = a série
   * existe mas não é deste treino.
   */
  createSetLog(
    patientProfileId: string,
    sessionId: string,
    input: CreateSetLogInput,
  ): Promise<SetLogRecord | null | 'FOREIGN_SET'>;

  /**
   * CHECK-IN (D-086): marca COMPLETED + `completedAt` e cria a avaliação
   * (D-087), na MESMA transação. Atômico porque a avaliação é obrigatória para
   * concluir: uma sessão COMPLETED sem rating — ou um rating órfão de sessão
   * aberta — é justamente o estado que o D-086 diz não existir.
   *
   * NÃO exige `SetLog`. A ausência de qualquer verificação de log aqui é a
   * decisão, não um esquecimento: concluir com zero séries registradas é o
   * caminho normal.
   */
  completeSession(
    patientProfileId: string,
    sessionId: string,
    input: CompleteSessionInput,
  ): Promise<WorkoutSessionDetailRecord | null>;

  /** Check-ins (COMPLETED) do período, com o `isFixed` do PLANO (D-092/D-105). */
  listAdherenceCheckInsForPatient(
    patientProfileId: string,
    from: Date,
    to: Date,
  ): Promise<AdherenceCheckInRecord[]>;

  listAdherenceCheckInsForBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
    from: Date,
    to: Date,
  ): Promise<AdherenceCheckInRecord[] | null>;
}

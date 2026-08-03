import type { PlanOrganization, SetTechnique, Weekday, WorkoutPlanStatus } from '@fitvo/database';

/** Projecao do plano (resumo, sem a arvore de treinos). */
export interface WorkoutPlanRecord {
  id: string;
  bondId: string;
  title: string;
  organization: PlanOrganization;
  status: WorkoutPlanStatus;
  validityDays: number;
  validUntil: Date | null;
  releaseAt: Date | null;
  goal: string | null;
  isFixed: boolean;
  fixedWeekdays: Weekday[];
  clonedFromWorkoutPlanId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutSetRecord {
  id: string;
  workoutItemId: string;
  position: number;
  reps: number | null;
  repsToFailure: boolean;
  weightGrams: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  bodyweight: boolean;
  restSeconds: number | null;
  technique: SetTechnique;
  note: string | null;
}

export interface WorkoutItemRecord {
  id: string;
  workoutId: string;
  exerciseId: string | null;
  position: number;
  supersetGroup: number | null;
  supersetOrder: number | null;
  note: string | null;
  sets: WorkoutSetRecord[];
}

export interface WorkoutRecord {
  id: string;
  planId: string;
  title: string;
  label: string | null;
  weekday: Weekday | null;
  position: number;
  items: WorkoutItemRecord[];
}

export interface WorkoutPlanDetailRecord extends WorkoutPlanRecord {
  workouts: WorkoutRecord[];
}

export interface CreateWorkoutPlanInput {
  tenantId: string;
  bondId: string;
  title: string;
  organization: PlanOrganization;
  validityDays: number;
  validUntil: Date;
  releaseAt: Date | null;
  goal: string | null;
  isFixed: boolean;
  fixedWeekdays: Weekday[];
}

export interface UpdateWorkoutPlanPatch {
  title?: string | undefined;
  organization?: PlanOrganization | undefined;
  validityDays?: number | undefined;
  validUntil?: Date | undefined;
  releaseAt?: Date | null | undefined;
  goal?: string | null | undefined;
  isFixed?: boolean | undefined;
  fixedWeekdays?: Weekday[] | undefined;
}

export interface CreateWorkoutInput {
  title: string;
  label: string | null;
  weekday: Weekday | null;
  position: number;
}

export interface UpdateWorkoutPatch {
  title?: string | undefined;
  /** Já normalizado pelo domínio (D-080): os dois campos viajam juntos ou nenhum. */
  slot?: { label: string | null; weekday: Weekday | null } | undefined;
  position?: number | undefined;
}

export interface CreateWorkoutItemInput {
  exerciseId: string | null;
  position: number;
  supersetGroup: number | null;
  supersetOrder: number | null;
  note: string | null;
}

export interface UpdateWorkoutItemPatch {
  exerciseId?: string | null | undefined;
  position?: number | undefined;
  supersetGroup?: number | null | undefined;
  supersetOrder?: number | null | undefined;
  note?: string | null | undefined;
}

/** Uma série a persistir; a `position` é o índice na lista (D-081). */
export interface WorkoutSetInputRecord {
  reps: number | null;
  repsToFailure: boolean;
  weightGrams: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  bodyweight: boolean;
  restSeconds: number | null;
  technique: SetTechnique;
  note: string | null;
}

/** Contexto do item necessário para validar as invariantes de grupo (D-082). */
export interface WorkoutItemContext {
  id: string;
  workoutId: string;
  supersetGroup: number | null;
  /** Itens IRMÃOS no mesmo treino (inclusive o próprio), com a contagem de séries de cada. */
  peers: { id: string; supersetGroup: number | null; setCount: number }[];
}

/** Plano com a organização — o que o domínio precisa para validar o treino (D-080). */
export interface WorkoutPlanContext {
  id: string;
  bondId: string;
  organization: PlanOrganization;
  status: WorkoutPlanStatus;
  validityDays: number;
  releaseAt: Date | null;
}

/**
 * Porta de persistência da prescrição de treino — Bloco 2 (ADR-0009).
 *
 * ISOLAMENTO EM DUAS CAMADAS, nenhuma opcional (D-166/ADR-0017 + D-079/ADR-0001):
 * toda operação é escopada por `tenantId` E por `professionalProfileId` dono do
 * `bond`. O `tenantId` é defense in depth (a extension do Prisma injeta o filtro
 * mesmo que o dev esqueça); o vínculo é o eixo que diz *de quem é aquele plano*.
 * Nenhuma leitura ou escrita aceita só o id do recurso.
 *
 * `null`/`false` de retorno = recurso inexistente OU fora do escopo do chamador.
 * O service traduz os dois para 404 — não distinguir é deliberado: dizer
 * "existe, mas não é seu" já vaza a existência de dado de outro paciente.
 */
export interface WorkoutRepository {
  /** Perfil profissional do chamador NESTE tenant (base do guard — D-002). */
  findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null>;

  /** Perfil de paciente do chamador (superfície do ALUNO — sem tenant no path). */
  findPatientProfile(accountId: string): Promise<{ patientProfileId: string } | null>;

  /** O vínculo existe e pertence a este profissional neste tenant? */
  findBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
  ): Promise<{ id: string } | null>;

  createPlan(input: CreateWorkoutPlanInput): Promise<WorkoutPlanRecord>;

  listPlansByBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
    filter: { status?: WorkoutPlanStatus | undefined },
  ): Promise<WorkoutPlanRecord[] | null>;

  /**
   * Planos visíveis ao ALUNO (D-165): escopo por `patientProfileId`, e NUNCA
   * DRAFT — plano em montagem não existe para quem vai executar. O filtro é do
   * repositório de propósito: uma cláusula SQL não depende de o chamador
   * lembrar de aplicá-la.
   */
  listPlansForPatient(patientProfileId: string): Promise<WorkoutPlanRecord[]>;

  findPlanContext(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
  ): Promise<WorkoutPlanContext | null>;

  findPlanDetail(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
  ): Promise<WorkoutPlanDetailRecord | null>;

  updatePlan(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
    patch: UpdateWorkoutPlanPatch,
  ): Promise<WorkoutPlanRecord | null>;

  /** Transição de estado explícita (D-083/D-084) — separada do patch de conteúdo. */
  updatePlanStatus(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
    status: WorkoutPlanStatus,
    validUntil?: Date | undefined,
  ): Promise<WorkoutPlanRecord | null>;

  /**
   * Clonagem PROFUNDA para outro vínculo (D-090): plano → treinos → itens →
   * séries, tudo em registros próprios do destino, numa TRANSAÇÃO. Registra a
   * linhagem em `clonedFromWorkoutPlanId` — ponteiro de auditoria, não rota de
   * leitura. NÃO copia execução: a sessão de um aluno nunca vira a de outro.
   */
  clonePlan(input: {
    tenantId: string;
    professionalProfileId: string;
    sourcePlanId: string;
    targetBondId: string;
    title: string | undefined;
    validUntil: Date;
  }): Promise<WorkoutPlanRecord | null>;

  createWorkout(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
    input: CreateWorkoutInput,
  ): Promise<WorkoutRecord | null>;

  findWorkoutPlanContext(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
  ): Promise<WorkoutPlanContext | null>;

  updateWorkout(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
    patch: UpdateWorkoutPatch,
  ): Promise<WorkoutRecord | null>;

  /** Deleção LÓGICA (D-089): tombstone `deletedAt`, nunca DELETE físico. */
  deleteWorkout(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
  ): Promise<boolean>;

  createItem(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
    input: CreateWorkoutItemInput,
  ): Promise<WorkoutItemRecord | null>;

  /** Item + irmãos do mesmo treino: insumo das invariantes de conjugado (D-082). */
  findItemContext(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
  ): Promise<WorkoutItemContext | null>;

  updateItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
    patch: UpdateWorkoutItemPatch,
  ): Promise<WorkoutItemRecord | null>;

  deleteItem(tenantId: string, professionalProfileId: string, itemId: string): Promise<boolean>;

  /**
   * Troca a lista COMPLETA de séries do item, em TRANSAÇÃO (D-081). Substituir
   * em bloco — em vez de CRUD série a série — é o que mantém as posições
   * contíguas e torna a validação do conjugado (D-082) atômica: ou o item fica
   * com a lista inteira nova, ou fica exatamente como estava.
   */
  replaceSets(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
    sets: WorkoutSetInputRecord[],
  ): Promise<WorkoutItemRecord | null>;
}

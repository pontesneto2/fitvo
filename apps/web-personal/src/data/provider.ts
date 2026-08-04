/**
 * A INTERFACE DE DADOS do painel. As telas dependem só disto — nunca de `fetch`,
 * de rota BFF ou do mock. Trocar o mock pela API real é fornecer outra
 * implementação desta interface no `DataProvider` (ver `context.tsx`): nenhuma
 * tela muda.
 *
 * As assinaturas espelham os contratos reais (`@fitvo/validation` — D-032), não
 * uma modelagem própria da UI: entradas são os `*Input` do contrato, saídas são
 * as `*View`. Por isso o mock devolve exatamente o que a API devolverá.
 *
 * TENANT: o `tenantId` NÃO aparece aqui de propósito. Na API real ele é path
 * param resolvido do contexto da sessão pela camada BFF (mesmo padrão de
 * `lib/api.ts`, que já anexa o Bearer no servidor). Deixar a tela escolher
 * tenant seria a UI decidindo isolamento — que é invariante de servidor.
 */
import type {
  ExerciseLibraryCreateExerciseInput,
  ExerciseLibraryCreateResult,
  ExerciseLibraryListQuery,
  ExerciseLibraryListResult,
  ExerciseLibraryMuscleGroupListResult,
  PatientBondView,
  PatientOverviewResult,
  WorkoutCreateItemInput,
  WorkoutCreatePlanInput,
  WorkoutCreateWorkoutInput,
  WorkoutItemView,
  WorkoutPlanDetailView,
  WorkoutPlanListQuery,
  WorkoutPlanListResult,
  WorkoutPlanSummaryView,
  WorkoutReplaceSetsInput,
  WorkoutUpdateItemInput,
  WorkoutUpdatePlanInput,
  WorkoutUpdateWorkoutInput,
  WorkoutView,
} from './types';

export interface FitvoDataProvider {
  // ---- Alunos / vínculos (ADR-0001) ----
  /** Convites pendentes + vínculos ativos do profissional. */
  listPatientOverview(): Promise<PatientOverviewResult>;
  getBond(bondId: string): Promise<PatientBondView>;

  // ---- Prescrição de treino (#133) ----
  listPlans(bondId: string, query?: WorkoutPlanListQuery): Promise<WorkoutPlanListResult>;
  getPlan(planId: string): Promise<WorkoutPlanDetailView>;
  createPlan(bondId: string, input: WorkoutCreatePlanInput): Promise<WorkoutPlanSummaryView>;
  updatePlan(planId: string, input: WorkoutUpdatePlanInput): Promise<WorkoutPlanSummaryView>;

  createWorkout(planId: string, input: WorkoutCreateWorkoutInput): Promise<WorkoutView>;
  updateWorkout(workoutId: string, input: WorkoutUpdateWorkoutInput): Promise<WorkoutView>;
  deleteWorkout(workoutId: string): Promise<void>;

  createItem(workoutId: string, input: WorkoutCreateItemInput): Promise<WorkoutItemView>;
  updateItem(itemId: string, input: WorkoutUpdateItemInput): Promise<WorkoutItemView>;
  deleteItem(itemId: string): Promise<void>;

  /** Substitui a lista COMPLETA de séries do item (D-081: a posição é o índice). */
  replaceSets(itemId: string, input: WorkoutReplaceSetsInput): Promise<WorkoutItemView>;

  // ---- Biblioteca de exercícios (#131) ----
  listMuscleGroups(): Promise<ExerciseLibraryMuscleGroupListResult>;
  listExercises(query?: ExerciseLibraryListQuery): Promise<ExerciseLibraryListResult>;
  createExercise(input: ExerciseLibraryCreateExerciseInput): Promise<ExerciseLibraryCreateResult>;
}

/**
 * Erro de aplicação do provider. Existe para as telas distinguirem "falhou" de
 * "falhou por regra" sem inspecionar string: o `code` espelha o campo `type` do
 * problem+json (RFC 7807) que a API real devolve, então o `catch` das telas não
 * muda quando o mock sair.
 */
export class DataProviderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DataProviderError';
    this.code = code;
  }
}

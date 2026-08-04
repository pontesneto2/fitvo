/**
 * Tipos de wire consumidos pelas telas. FONTE ÚNICA: `@fitvo/validation` (D-032)
 * — os mesmos schemas Zod de onde a API deriva os handlers e o OpenAPI. Nenhum
 * DTO é redefinido aqui; este arquivo só reexporta e nomeia as formas que o
 * `@fitvo/validation` expõe como schema mas ainda não como tipo.
 *
 * NOTA DE DÍVIDA: `packages/contracts` (o barrel oficial de consumo do D-032)
 * ainda não reexporta os tipos de treino (#133) nem de biblioteca (#131) — só
 * auth/billing/clinic/consent/patient. Enquanto isso, importar de
 * `@fitvo/validation` é o caminho que NÃO cria uma terceira fonte; quando o
 * barrel for atualizado, trocar o import aqui e só aqui.
 */
import type {
  ExerciseLibraryCreateExerciseInput,
  ExerciseLibraryCreateResult,
  ExerciseLibraryExerciseView,
  ExerciseLibraryListQuery,
  ExerciseLibraryListResult,
  ExerciseLibraryMuscleGroupListResult,
  ExerciseLibraryMuscleGroupView,
  PatientBondView,
  PatientInviteView,
  PatientOverviewResult,
  WorkoutCreateItemInput,
  WorkoutCreatePlanInput,
  WorkoutCreateWorkoutInput,
  WorkoutItemView,
  WorkoutPlanDetailView,
  WorkoutPlanListQuery,
  workoutPlanListResultSchema,
  WorkoutPlanSummaryView,
  WorkoutReplaceSetsInput,
  WorkoutSetView,
  WorkoutUpdateItemInput,
  WorkoutUpdatePlanInput,
  WorkoutUpdateWorkoutInput,
  WorkoutView,
} from '@fitvo/validation';
import type { z } from 'zod';

export type {
  ExerciseLibraryCreateExerciseInput,
  ExerciseLibraryCreateResult,
  ExerciseLibraryExerciseView,
  ExerciseLibraryListQuery,
  ExerciseLibraryListResult,
  ExerciseLibraryMuscleGroupListResult,
  ExerciseLibraryMuscleGroupView,
  PatientBondView,
  PatientInviteView,
  PatientOverviewResult,
  WorkoutCreateItemInput,
  WorkoutCreatePlanInput,
  WorkoutCreateWorkoutInput,
  WorkoutItemView,
  WorkoutPlanDetailView,
  WorkoutPlanListQuery,
  WorkoutPlanSummaryView,
  WorkoutReplaceSetsInput,
  WorkoutSetView,
  WorkoutUpdateItemInput,
  WorkoutUpdatePlanInput,
  WorkoutUpdateWorkoutInput,
  WorkoutView,
};

/** `workoutPlanListResultSchema` existe em `@fitvo/validation`, mas o tipo não é
 *  reexportado de lá; inferir do schema mantém a fonte única. */
export type WorkoutPlanListResult = z.infer<typeof workoutPlanListResultSchema>;

/** Entrada de UMA série (D-081). O schema de entrada é privado no
 *  `@fitvo/validation` (só o array sai em `workoutReplaceSetsSchema`), então o
 *  elemento é derivado do array — não redigitado. */
export type WorkoutSetInput = WorkoutReplaceSetsInput['sets'][number];

/** Enums do contrato, promovidos a tipo nomeado para uso nas telas. */
export type PlanOrganization = WorkoutPlanSummaryView['organization'];
export type PlanStatus = WorkoutPlanSummaryView['status'];
export type Weekday = WorkoutPlanSummaryView['fixedWeekdays'][number];
export type SetTechnique = WorkoutSetView['technique'];

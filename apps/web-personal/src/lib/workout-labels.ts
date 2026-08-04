/**
 * Rótulos pt-BR e formatação do domínio de treino. Externalizado em um módulo
 * (mesma convenção de `app/cadastro/options.ts`) para que nenhuma tela hardcode
 * texto de enum — quando um segundo idioma entrar, só este arquivo se desdobra.
 *
 * A formatação vive aqui pelo mesmo motivo que o `deriveDisplayName` vive no
 * servidor: derivação repetida em cada tela é derivação que passa a divergir.
 * O contrato guarda GRAMAS/SEGUNDOS/METROS inteiros (D-081) — a conversão para
 * kg/min/km é exclusivamente de EXIBIÇÃO e acontece só aqui.
 */
import type {
  ExerciseLibraryItemStatus,
  ExerciseLibraryVisibility,
  PatientBondView,
} from '@fitvo/validation';

import type {
  PlanOrganization,
  PlanStatus,
  SetTechnique,
  Weekday,
  WorkoutSetView,
} from '@/data/types';

// ---- Enums ------------------------------------------------------------------

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendado',
  ACTIVE: 'Ativo',
  EXPIRED: 'Vencido',
  ARCHIVED: 'Arquivado',
};

/** Variante de `Badge` por estado. O vencido é `warning`, não `error`: vencer é
 *  o ciclo normal do plano (D-083), não uma falha. */
export const PLAN_STATUS_BADGE: Record<PlanStatus, 'neutral' | 'brand' | 'success' | 'warning'> = {
  DRAFT: 'neutral',
  SCHEDULED: 'brand',
  ACTIVE: 'success',
  EXPIRED: 'warning',
  ARCHIVED: 'neutral',
};

export const PLAN_ORGANIZATION_LABEL: Record<PlanOrganization, string> = {
  LETTER: 'Por letra (A/B/C)',
  WEEKDAY: 'Por dia da semana',
};

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MONDAY: 'Segunda-feira',
  TUESDAY: 'Terça-feira',
  WEDNESDAY: 'Quarta-feira',
  THURSDAY: 'Quinta-feira',
  FRIDAY: 'Sexta-feira',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export const WEEKDAY_SHORT_LABEL: Record<Weekday, string> = {
  MONDAY: 'Seg',
  TUESDAY: 'Ter',
  WEDNESDAY: 'Qua',
  THURSDAY: 'Qui',
  FRIDAY: 'Sex',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

export const WEEKDAY_ORDER: readonly Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const SET_TECHNIQUE_LABEL: Record<SetTechnique, string> = {
  NORMAL: 'Normal',
  DROP_SET: 'Drop set',
};

export const MODALITY_LABEL: Record<PatientBondView['modality'], string> = {
  ONLINE: 'Online',
  PRESENCIAL: 'Presencial',
  HIBRIDO: 'Híbrido',
};

export const VISIBILITY_LABEL: Record<ExerciseLibraryVisibility, string> = {
  PLATFORM: 'Base FITVO',
  PRIVATE: 'Meu acervo',
};

export const EXERCISE_STATUS_LABEL: Record<ExerciseLibraryItemStatus, string> = {
  ACTIVE: 'Ativo',
  DISCONTINUED: 'Descontinuado',
};

// ---- Formatação de grandezas ------------------------------------------------

const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** Gramas → kg. 22500 vira "22,5 kg"; 40000 vira "40 kg". */
export function formatWeight(grams: number): string {
  return `${decimal.format(grams / 1000)} kg`;
}

/** Segundos → "45 s", "1 min 30 s", "2 min". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${integer.format(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${integer.format(minutes)} min` : `${integer.format(minutes)} min ${rest} s`;
}

/** Metros → "800 m" ou "2 km". */
export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${decimal.format(meters / 1000)} km` : `${integer.format(meters)} m`;
}

/** Descanso da série. Zero é informação (conjugado — D-082), não ausência. */
export function formatRest(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds === 0) return 'sem pausa';
  return formatDuration(seconds);
}

/** Repetições prescritas: número, "até a falha" (D-081) ou vazio. */
export function formatReps(set: Pick<WorkoutSetView, 'reps' | 'repsToFailure'>): string {
  if (set.repsToFailure) return 'até a falha';
  return set.reps === null ? '—' : integer.format(set.reps);
}

/**
 * A GRANDEZA da série. Exatamente uma está preenchida (D-081 — colunas
 * tipadas), então o encadeamento não esconde ambiguidade: ele reflete a
 * invariante que o contrato já garante.
 */
export function formatLoad(
  set: Pick<WorkoutSetView, 'weightGrams' | 'durationSeconds' | 'distanceMeters' | 'bodyweight'>,
): string {
  if (set.weightGrams !== null) return formatWeight(set.weightGrams);
  if (set.durationSeconds !== null) return formatDuration(set.durationSeconds);
  if (set.distanceMeters !== null) return formatDistance(set.distanceMeters);
  if (set.bodyweight) return 'peso corporal';
  return '—';
}

/** Tipo de grandeza — usado pelo editor para escolher o campo a mostrar. */
export type LoadKind = 'WEIGHT' | 'DURATION' | 'DISTANCE' | 'BODYWEIGHT';

export const LOAD_KIND_LABEL: Record<LoadKind, string> = {
  WEIGHT: 'Peso (kg)',
  DURATION: 'Tempo',
  DISTANCE: 'Distância',
  BODYWEIGHT: 'Peso corporal',
};

export function loadKindOf(
  set: Pick<WorkoutSetView, 'weightGrams' | 'durationSeconds' | 'distanceMeters' | 'bodyweight'>,
): LoadKind {
  if (set.durationSeconds !== null) return 'DURATION';
  if (set.distanceMeters !== null) return 'DISTANCE';
  if (set.bodyweight) return 'BODYWEIGHT';
  return 'WEIGHT';
}

/** O slot do treino: letra (plano LETTER) ou dia (plano WEEKDAY) — D-080. */
export function formatWorkoutSlot(workout: {
  label: string | null;
  weekday: Weekday | null;
}): string | null {
  if (workout.label !== null) return workout.label;
  if (workout.weekday !== null) return WEEKDAY_SHORT_LABEL[workout.weekday];
  return null;
}

/** Data ISO (UTC no contrato) no fuso do leitor — conversão só na exibição. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(iso));
}

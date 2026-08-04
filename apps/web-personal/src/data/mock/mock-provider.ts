/**
 * Implementação em memória do `FitvoDataProvider`. Existe para as telas serem
 * construídas e revisadas antes de a API estar ligada — e some sem tocar em
 * tela nenhuma quando ela estiver.
 *
 * Três cuidados que evitam o mock mentir sobre o comportamento real:
 *
 * 1. LATÊNCIA. Toda operação passa por um atraso; sem isso os estados de
 *    carregamento nunca aparecem e a tela é revisada sem eles.
 * 2. CÓPIA NA LEITURA E NA ESCRITA. O store devolve estrutura clonada, então a
 *    tela não consegue mutar o "banco" por referência — o que a API real
 *    também não permitiria, e cuja ausência esconderia bug de imutabilidade.
 * 3. AS INVARIANTES DO CONTRATO SÃO DO SERVIDOR. A posição da série é o índice
 *    do array (D-081) e `countsTowardAdherence` é derivado (D-105) — aqui,
 *    como lá, quem calcula é o provider, nunca a tela.
 *
 * O que este mock NÃO faz: inventar regra que nenhum ADR decidiu. Onde o
 * comportamento real depende de decisão pendente (promoção PRIVATE→PLATFORM,
 * por exemplo), a operação simplesmente não existe na interface.
 */
import type { FitvoDataProvider } from '../provider';
import { DataProviderError } from '../provider';
import type {
  ExerciseLibraryCreateExerciseInput,
  ExerciseLibraryCreateResult,
  ExerciseLibraryExerciseView,
  ExerciseLibraryListQuery,
  ExerciseLibraryListResult,
  ExerciseLibraryMuscleGroupListResult,
  ExerciseLibraryMuscleGroupView,
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
} from '../types';
import { SEED_EXERCISES, SEED_MUSCLE_GROUPS, SEED_OVERVIEW, SEED_PLANS } from './seed';

const DEFAULT_LATENCY_MS = 220;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Normalização do D-169: sem acento, minúsculo, separadores colapsados. "supino
 * reto", "Supino Reto" e "supino-reto" precisam colidir — igualdade literal
 * deixaria a biblioteca encher de duplicata.
 */
export function normalizeExerciseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function notFound(what: string, id: string): DataProviderError {
  return new DataProviderError('not-found', `${what} não encontrado (${id}).`);
}

export interface MockProviderOptions {
  /** Atraso artificial por operação, em ms. Zero deixa o teste síncrono. */
  readonly latencyMs?: number;
}

export function createMockDataProvider(options: MockProviderOptions = {}): FitvoDataProvider {
  const latencyMs = options.latencyMs ?? DEFAULT_LATENCY_MS;

  // Estado mutável do "banco". Clonado da semente para que recarregar a página
  // devolva o mesmo ponto de partida.
  const overview: PatientOverviewResult = clone(SEED_OVERVIEW);
  const muscleGroups: ExerciseLibraryMuscleGroupView[] = clone([...SEED_MUSCLE_GROUPS]);
  const exercises: ExerciseLibraryExerciseView[] = clone([...SEED_EXERCISES]);
  const plans: WorkoutPlanDetailView[] = clone([...SEED_PLANS]);

  let sequence = 0;
  const nextId = (prefix: string): string => {
    sequence += 1;
    return `${prefix}-${sequence}`;
  };

  const now = (): string => new Date().toISOString();

  async function settle<T>(value: T): Promise<T> {
    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }
    return clone(value);
  }

  function requirePlan(planId: string): WorkoutPlanDetailView {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) throw notFound('Plano', planId);
    return plan;
  }

  function requireWorkout(workoutId: string): {
    plan: WorkoutPlanDetailView;
    workout: WorkoutView;
  } {
    for (const plan of plans) {
      const workout = plan.workouts.find((w) => w.id === workoutId);
      if (workout) return { plan, workout };
    }
    throw notFound('Treino', workoutId);
  }

  function requireItem(itemId: string): {
    plan: WorkoutPlanDetailView;
    workout: WorkoutView;
    item: WorkoutItemView;
  } {
    for (const plan of plans) {
      for (const workout of plan.workouts) {
        const item = workout.items.find((i) => i.id === itemId);
        if (item) return { plan, workout, item };
      }
    }
    throw notFound('Item', itemId);
  }

  /** Reindexa `position` a partir da ordem do array — a ordem É a posição. */
  function reindex<T extends { position: number }>(list: T[]): T[] {
    return list.map((entry, index) => ({ ...entry, position: index }));
  }

  function toSummary(plan: WorkoutPlanDetailView): WorkoutPlanSummaryView {
    const { workouts: _workouts, ...summary } = plan;
    return summary;
  }

  function touch(plan: WorkoutPlanDetailView): void {
    plan.updatedAt = now();
  }

  return {
    // ---- Alunos ----
    listPatientOverview: () => settle(overview),

    getBond: (bondId: string): Promise<PatientBondView> => {
      const found = overview.activeBonds.find((b) => b.id === bondId);
      if (!found) throw notFound('Vínculo', bondId);
      return settle(found);
    },

    // ---- Planos ----
    listPlans: (bondId: string, query?: WorkoutPlanListQuery): Promise<WorkoutPlanListResult> => {
      const found = plans
        .filter((p) => p.bondId === bondId)
        .filter((p) => query?.status === undefined || p.status === query.status)
        .map(toSummary);
      return settle({ plans: found });
    },

    getPlan: (planId: string) => settle(requirePlan(planId)),

    createPlan: (bondId: string, input: WorkoutCreatePlanInput) => {
      const timestamp = now();
      const isFixed = input.isFixed ?? false;
      const plan: WorkoutPlanDetailView = {
        id: nextId('plan'),
        bondId,
        title: input.title,
        organization: input.organization,
        // D-084: liberação futura nasce SCHEDULED; sem ela, o plano nasce em
        // rascunho e só o profissional decide publicar.
        status: input.releaseAt != null ? 'SCHEDULED' : 'DRAFT',
        validityDays: input.validityDays ?? 30,
        validUntil: null,
        releaseAt: input.releaseAt ?? null,
        goal: input.goal ?? null,
        isFixed,
        fixedWeekdays: isFixed ? (input.fixedWeekdays ?? []) : [],
        // Derivado no servidor (D-105): plano fixo não conta para a aderência.
        countsTowardAdherence: !isFixed,
        clonedFromWorkoutPlanId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        workouts: [],
      };
      plans.push(plan);
      return settle(toSummary(plan));
    },

    updatePlan: (planId: string, input: WorkoutUpdatePlanInput) => {
      const plan = requirePlan(planId);
      if (input.title !== undefined) plan.title = input.title;
      if (input.organization !== undefined) plan.organization = input.organization;
      if (input.validityDays !== undefined) plan.validityDays = input.validityDays;
      if (input.releaseAt !== undefined) plan.releaseAt = input.releaseAt ?? null;
      if (input.goal !== undefined) plan.goal = input.goal ?? null;
      if (input.isFixed !== undefined) {
        plan.isFixed = input.isFixed;
        plan.countsTowardAdherence = !input.isFixed;
        if (!input.isFixed) plan.fixedWeekdays = [];
      }
      if (input.fixedWeekdays !== undefined && plan.isFixed) {
        plan.fixedWeekdays = input.fixedWeekdays;
      }
      touch(plan);
      return settle(toSummary(plan));
    },

    // ---- Treinos ----
    createWorkout: (planId: string, input: WorkoutCreateWorkoutInput) => {
      const plan = requirePlan(planId);
      const workout: WorkoutView = {
        id: nextId('w'),
        planId,
        title: input.title,
        label: input.label ?? null,
        weekday: input.weekday ?? null,
        position: input.position ?? plan.workouts.length,
        items: [],
      };
      plan.workouts = reindex([...plan.workouts, workout]);
      touch(plan);
      const created = plan.workouts.find((w) => w.id === workout.id);
      return settle(created ?? workout);
    },

    updateWorkout: (workoutId: string, input: WorkoutUpdateWorkoutInput) => {
      const { plan, workout } = requireWorkout(workoutId);
      if (input.title !== undefined) workout.title = input.title;
      // D-080: um treino ocupa UM slot. Definir a letra limpa o dia e vice-versa
      // — manter os dois seria duas respostas para "quando este treino ocorre".
      if (input.label !== undefined) {
        workout.label = input.label ?? null;
        if (input.label != null) workout.weekday = null;
      }
      if (input.weekday !== undefined) {
        workout.weekday = input.weekday ?? null;
        if (input.weekday != null) workout.label = null;
      }
      if (input.position !== undefined) {
        const rest = plan.workouts.filter((w) => w.id !== workoutId);
        rest.splice(Math.min(input.position, rest.length), 0, workout);
        plan.workouts = reindex(rest);
      }
      touch(plan);
      return settle(workout);
    },

    deleteWorkout: async (workoutId: string) => {
      const { plan } = requireWorkout(workoutId);
      plan.workouts = reindex(plan.workouts.filter((w) => w.id !== workoutId));
      touch(plan);
      await settle(null);
    },

    // ---- Itens ----
    createItem: (workoutId: string, input: WorkoutCreateItemInput) => {
      const { plan, workout } = requireWorkout(workoutId);
      const item: WorkoutItemView = {
        id: nextId('it'),
        workoutId,
        exerciseId: input.exerciseId ?? null,
        position: input.position ?? workout.items.length,
        supersetGroup: input.supersetGroup ?? null,
        supersetOrder: input.supersetOrder ?? null,
        note: input.note ?? null,
        sets: [],
      };
      workout.items = reindex([...workout.items, item]);
      touch(plan);
      const created = workout.items.find((i) => i.id === item.id);
      return settle(created ?? item);
    },

    updateItem: (itemId: string, input: WorkoutUpdateItemInput) => {
      const { plan, workout, item } = requireItem(itemId);
      if (input.exerciseId !== undefined) item.exerciseId = input.exerciseId ?? null;
      if (input.note !== undefined) item.note = input.note ?? null;
      // D-082: grupo e ordem andam juntos. Sair do conjugado zera os dois.
      if (input.supersetGroup !== undefined) item.supersetGroup = input.supersetGroup ?? null;
      if (input.supersetOrder !== undefined) item.supersetOrder = input.supersetOrder ?? null;
      if (item.supersetGroup === null) item.supersetOrder = null;
      if (input.position !== undefined) {
        const rest = workout.items.filter((i) => i.id !== itemId);
        rest.splice(Math.min(input.position, rest.length), 0, item);
        workout.items = reindex(rest);
      }
      touch(plan);
      return settle(item);
    },

    deleteItem: async (itemId: string) => {
      const { plan, workout } = requireItem(itemId);
      workout.items = reindex(workout.items.filter((i) => i.id !== itemId));
      touch(plan);
      await settle(null);
    },

    replaceSets: (itemId: string, input: WorkoutReplaceSetsInput) => {
      const { plan, item } = requireItem(itemId);
      // D-081: a lista chega COMPLETA e a posição é o índice — nunca um campo
      // que o cliente manda e que poderia colidir.
      item.sets = input.sets.map((set, index) => ({
        id: `${itemId}-set-${index + 1}`,
        workoutItemId: itemId,
        position: index,
        reps: set.reps ?? null,
        repsToFailure: set.repsToFailure ?? false,
        weightGrams: set.weightGrams ?? null,
        durationSeconds: set.durationSeconds ?? null,
        distanceMeters: set.distanceMeters ?? null,
        bodyweight: set.bodyweight ?? false,
        restSeconds: set.restSeconds ?? null,
        technique: set.technique ?? 'NORMAL',
        note: set.note ?? null,
      }));
      touch(plan);
      return settle(item);
    },

    // ---- Biblioteca ----
    listMuscleGroups: (): Promise<ExerciseLibraryMuscleGroupListResult> =>
      settle({ muscleGroups: [...muscleGroups].sort((a, b) => a.displayOrder - b.displayOrder) }),

    listExercises: (query?: ExerciseLibraryListQuery): Promise<ExerciseLibraryListResult> => {
      const search = query?.search === undefined ? null : normalizeExerciseName(query.search);
      const found = exercises
        // D-089: descontinuado some da busca por padrão, mas continua existindo
        // para o histórico — e a tela de administração precisa poder vê-lo.
        .filter((e) => query?.includeDiscontinued === true || e.status === 'ACTIVE')
        .filter(
          (e) =>
            query?.muscleGroupId === undefined || e.primaryMuscleGroup.id === query.muscleGroupId,
        )
        .filter((e) => search === null || normalizeExerciseName(e.name).includes(search))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      return settle({ exercises: found });
    },

    createExercise: (
      input: ExerciseLibraryCreateExerciseInput,
    ): Promise<ExerciseLibraryCreateResult> => {
      const normalized = normalizeExerciseName(input.name);
      const existing = exercises.find((e) => normalizeExerciseName(e.name) === normalized);
      // D-169: duplicata NÃO é erro — o servidor devolve o item que já existe
      // para o profissional usar, em vez de criar uma segunda linha igual.
      if (existing) {
        return settle({ outcome: 'DUPLICATE_FOUND', exercise: existing });
      }

      const primary = muscleGroups.find((g) => g.id === input.primaryMuscleGroupId);
      if (!primary) throw notFound('Grupo muscular', input.primaryMuscleGroupId);

      const timestamp = now();
      const created: ExerciseLibraryExerciseView = {
        id: nextId('ex'),
        name: input.name,
        description: input.description ?? null,
        videoStorageKey: input.videoStorageKey ?? null,
        // D-170: item de profissional nasce SEMPRE PRIVATE. A entrada nem
        // aceita `visibility` — o sistema nunca auto-promove para a base comum.
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        specialtyId: input.specialtyId ?? null,
        ownerProfessionalProfileId: 'prof-1',
        primaryMuscleGroup: primary,
        secondaryMuscleGroups: (input.secondaryMuscleGroupIds ?? [])
          .map((id) => muscleGroups.find((g) => g.id === id))
          .filter((g): g is ExerciseLibraryMuscleGroupView => g !== undefined),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      exercises.push(created);
      return settle({ outcome: 'CREATED', exercise: created });
    },
  };
}

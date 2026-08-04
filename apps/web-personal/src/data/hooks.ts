'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDataProvider } from './context';
import type {
  ExerciseLibraryCreateExerciseInput,
  ExerciseLibraryCreateResult,
  ExerciseLibraryExerciseView,
  ExerciseLibraryListQuery,
  ExerciseLibraryListResult,
  ExerciseLibraryMuscleGroupListResult,
  PatientBondView,
  PatientOverviewResult,
  WorkoutCreateItemInput,
  WorkoutCreatePlanInput,
  WorkoutCreateWorkoutInput,
  WorkoutPlanDetailView,
  WorkoutPlanListQuery,
  WorkoutPlanListResult,
  WorkoutReplaceSetsInput,
  WorkoutUpdateItemInput,
  WorkoutUpdatePlanInput,
  WorkoutUpdateWorkoutInput,
} from './types';

/**
 * Chaves de cache em um só lugar. Espalhá-las pelas telas é como o cache passa a
 * invalidar errado: uma tela grava `['plan', id]` e outra lê `['plans', id]`,
 * e a lista para de atualizar depois de salvar sem ninguém entender por quê.
 */
export const queryKeys = {
  patientOverview: ['patient-overview'] as const,
  bond: (bondId: string) => ['bond', bondId] as const,
  plans: (bondId: string, query?: WorkoutPlanListQuery) =>
    ['plans', bondId, query ?? null] as const,
  plan: (planId: string) => ['plan', planId] as const,
  muscleGroups: ['muscle-groups'] as const,
  exercises: (query?: ExerciseLibraryListQuery) => ['exercises', query ?? null] as const,
};

// ---- Alunos -----------------------------------------------------------------

export function usePatientOverview(): UseQueryResult<PatientOverviewResult> {
  const provider = useDataProvider();
  return useQuery({
    queryKey: queryKeys.patientOverview,
    queryFn: () => provider.listPatientOverview(),
  });
}

export function useBond(bondId: string): UseQueryResult<PatientBondView> {
  const provider = useDataProvider();
  return useQuery({
    queryKey: queryKeys.bond(bondId),
    queryFn: () => provider.getBond(bondId),
  });
}

// ---- Planos -----------------------------------------------------------------

export function usePlans(
  bondId: string,
  query?: WorkoutPlanListQuery,
): UseQueryResult<WorkoutPlanListResult> {
  const provider = useDataProvider();
  return useQuery({
    queryKey: queryKeys.plans(bondId, query),
    queryFn: () => provider.listPlans(bondId, query),
  });
}

export function usePlan(planId: string): UseQueryResult<WorkoutPlanDetailView> {
  const provider = useDataProvider();
  return useQuery({
    queryKey: queryKeys.plan(planId),
    queryFn: () => provider.getPlan(planId),
  });
}

export function useCreatePlan(bondId: string) {
  const provider = useDataProvider();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutCreatePlanInput) => provider.createPlan(bondId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans', bondId] });
    },
  });
}

export function useUpdatePlan(planId: string) {
  const provider = useDataProvider();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutUpdatePlanInput) => provider.updatePlan(planId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plan(planId) });
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

/**
 * Mutações da ESTRUTURA do plano (treinos, itens, séries). Todas invalidam o
 * mesmo plano: qualquer uma delas muda a árvore que a tela de prescrição
 * desenha, e invalidar só a parte alterada deixaria posições reindexadas pelo
 * servidor desatualizadas na tela.
 */
export function usePlanStructureMutations(planId: string) {
  const provider = useDataProvider();
  const queryClient = useQueryClient();
  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.plan(planId) });
  };

  const createWorkout = useMutation({
    mutationFn: (input: WorkoutCreateWorkoutInput) => provider.createWorkout(planId, input),
    onSuccess: invalidate,
  });

  const updateWorkout = useMutation({
    mutationFn: (vars: { workoutId: string; input: WorkoutUpdateWorkoutInput }) =>
      provider.updateWorkout(vars.workoutId, vars.input),
    onSuccess: invalidate,
  });

  const deleteWorkout = useMutation({
    mutationFn: (workoutId: string) => provider.deleteWorkout(workoutId),
    onSuccess: invalidate,
  });

  const createItem = useMutation({
    mutationFn: (vars: { workoutId: string; input: WorkoutCreateItemInput }) =>
      provider.createItem(vars.workoutId, vars.input),
    onSuccess: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: (vars: { itemId: string; input: WorkoutUpdateItemInput }) =>
      provider.updateItem(vars.itemId, vars.input),
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => provider.deleteItem(itemId),
    onSuccess: invalidate,
  });

  const replaceSets = useMutation({
    mutationFn: (vars: { itemId: string; input: WorkoutReplaceSetsInput }) =>
      provider.replaceSets(vars.itemId, vars.input),
    onSuccess: invalidate,
  });

  return {
    createWorkout,
    updateWorkout,
    deleteWorkout,
    createItem,
    updateItem,
    deleteItem,
    replaceSets,
  };
}

// ---- Biblioteca -------------------------------------------------------------

export function useMuscleGroups(): UseQueryResult<ExerciseLibraryMuscleGroupListResult> {
  const provider = useDataProvider();
  return useQuery({
    queryKey: queryKeys.muscleGroups,
    queryFn: () => provider.listMuscleGroups(),
    staleTime: Infinity, // taxonomia fechada: não muda durante a sessão.
  });
}

export function useExercises(
  query?: ExerciseLibraryListQuery,
): UseQueryResult<ExerciseLibraryListResult> {
  const provider = useDataProvider();
  return useQuery({
    queryKey: queryKeys.exercises(query),
    queryFn: () => provider.listExercises(query),
  });
}

/**
 * Índice `exerciseId → exercício` para a tela de prescrição resolver o nome do
 * item. Inclui os DESCONTINUADOS de propósito: o item some da BUSCA (D-089),
 * mas um plano montado antes continua apontando para ele — sem isso a linha do
 * treino ficaria sem nome exatamente no caso que mais confunde.
 */
export function useExerciseIndex(): {
  index: ReadonlyMap<string, ExerciseLibraryExerciseView>;
  isLoading: boolean;
} {
  const query = useExercises({ includeDiscontinued: true });
  const index = useMemo(
    () => new Map((query.data?.exercises ?? []).map((exercise) => [exercise.id, exercise])),
    [query.data],
  );
  return { index, isLoading: query.isLoading };
}

export function useCreateExercise() {
  const provider = useDataProvider();
  const queryClient = useQueryClient();
  return useMutation<ExerciseLibraryCreateResult, Error, ExerciseLibraryCreateExerciseInput>({
    mutationFn: (input) => provider.createExercise(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
}

import { z } from 'zod';

/**
 * Contrato da BIBLIOTECA DE EXERCICIOS (D-089/D-091/D-164, D-168 a D-171 —
 * ADR-0009) — fonte unica (D-032).
 *
 * Escopo da biblioteca e POR PROFISSIONAL, nao por tenant (D-171): o
 * profissional enxerga a base PLATFORM (compartilhada) + os PRIVATE dele. O
 * `:tenantId` do path serve ao guard de perfil profissional e ao contexto de
 * tenant (D-150), nao ao filtro da biblioteca.
 */

export const exerciseLibraryTenantParamsSchema = z.object({
  tenantId: z.string().min(1),
});

export const exerciseLibraryExerciseParamsSchema = z.object({
  tenantId: z.string().min(1),
  exerciseId: z.string().min(1),
});

export const exerciseLibraryVisibilitySchema = z.enum(['PLATFORM', 'PRIVATE']);
export const exerciseLibraryItemStatusSchema = z.enum(['ACTIVE', 'DISCONTINUED']);

export const exerciseLibraryMuscleGroupViewSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  displayOrder: z.number().int(),
});

export const exerciseLibraryMuscleGroupListResultSchema = z.object({
  muscleGroups: z.array(exerciseLibraryMuscleGroupViewSchema),
});

export const exerciseLibraryExerciseViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  videoStorageKey: z.string().nullable(),
  visibility: exerciseLibraryVisibilitySchema,
  status: exerciseLibraryItemStatusSchema,
  specialtyId: z.string().nullable(),
  ownerProfessionalProfileId: z.string().nullable(),
  primaryMuscleGroup: exerciseLibraryMuscleGroupViewSchema,
  secondaryMuscleGroups: z.array(exerciseLibraryMuscleGroupViewSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const exerciseLibraryListResultSchema = z.object({
  exercises: z.array(exerciseLibraryExerciseViewSchema),
});

/**
 * Busca da biblioteca. `includeDiscontinued` existe porque a delecao e LOGICA
 * (D-089): o item descontinuado SOME da busca por padrao mas continua
 * funcionando no historico — a tela de administracao da propria biblioteca
 * precisa conseguir ve-lo.
 */
export const exerciseLibraryListQuerySchema = z.object({
  search: z.string().min(1).optional(),
  muscleGroupId: z.string().min(1).optional(),
  includeDiscontinued: z.coerce.boolean().optional(),
});

/**
 * Criacao de exercicio. NAO aceita `visibility`: item de profissional nasce
 * SEMPRE PRIVATE (D-170 — default seguro; o sistema nunca auto-promove para a
 * base comum). A promocao PRIVATE -> PLATFORM depende de um fluxo de curadoria
 * que NENHUM ADR decidiu — nao inventar aqui.
 */
export const exerciseLibraryCreateExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  primaryMuscleGroupId: z.string().min(1),
  secondaryMuscleGroupIds: z.array(z.string().min(1)).max(10).optional(),
  description: z.string().max(4000).optional(),
  specialtyId: z.string().min(1).optional(),
  /**
   * Chave S3 do video demonstrativo (D-091). O UPLOAD em si (via
   * @fitvo/storage) e outra fatia: aqui a biblioteca so guarda a REFERENCIA,
   * mesmo padrao de ProgressPhoto.storageKey.
   */
  videoStorageKey: z.string().min(1).max(500).optional(),
});

export const exerciseLibraryUpdateExerciseSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    primaryMuscleGroupId: z.string().min(1).optional(),
    secondaryMuscleGroupIds: z.array(z.string().min(1)).max(10).optional(),
    description: z.string().max(4000).nullable().optional(),
    videoStorageKey: z.string().min(1).max(500).nullable().optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para atualizar.',
  });

/**
 * Resultado da criacao (D-169 — anti-duplicacao normalizada NA ENTRADA). A
 * comparacao e por nome NORMALIZADO (sem acento, minusculo, separadores
 * colapsados), nunca igualdade literal: "supino reto", "Supino Reto" e
 * "supino-reto" sao o MESMO item.
 *
 * `DUPLICATE_FOUND` nao e erro — e a decisao do D-169 de OFERECER O EXISTENTE
 * em vez de criar uma segunda linha. `exercise` traz o item que o profissional
 * deve usar: o recem-criado (CREATED, HTTP 201) ou o equivalente que ja existia
 * (DUPLICATE_FOUND, HTTP 200).
 */
export const exerciseLibraryCreateResultSchema = z.object({
  outcome: z.enum(['CREATED', 'DUPLICATE_FOUND']),
  exercise: exerciseLibraryExerciseViewSchema,
});

export type ExerciseLibraryTenantParams = z.infer<typeof exerciseLibraryTenantParamsSchema>;
export type ExerciseLibraryExerciseParams = z.infer<typeof exerciseLibraryExerciseParamsSchema>;
export type ExerciseLibraryVisibility = z.infer<typeof exerciseLibraryVisibilitySchema>;
export type ExerciseLibraryItemStatus = z.infer<typeof exerciseLibraryItemStatusSchema>;
export type ExerciseLibraryMuscleGroupView = z.infer<typeof exerciseLibraryMuscleGroupViewSchema>;
export type ExerciseLibraryMuscleGroupListResult = z.infer<
  typeof exerciseLibraryMuscleGroupListResultSchema
>;
export type ExerciseLibraryExerciseView = z.infer<typeof exerciseLibraryExerciseViewSchema>;
export type ExerciseLibraryListResult = z.infer<typeof exerciseLibraryListResultSchema>;
export type ExerciseLibraryListQuery = z.infer<typeof exerciseLibraryListQuerySchema>;
export type ExerciseLibraryCreateExerciseInput = z.infer<
  typeof exerciseLibraryCreateExerciseSchema
>;
export type ExerciseLibraryUpdateExerciseInput = z.infer<
  typeof exerciseLibraryUpdateExerciseSchema
>;
export type ExerciseLibraryCreateResult = z.infer<typeof exerciseLibraryCreateResultSchema>;

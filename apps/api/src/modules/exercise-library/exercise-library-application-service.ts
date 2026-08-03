import { normalizeLibraryItemName } from '@fitvo/database';
import type {
  ExerciseLibraryCreateExerciseInput,
  ExerciseLibraryCreateResult,
  ExerciseLibraryExerciseView,
  ExerciseLibraryListQuery,
  ExerciseLibraryMuscleGroupView,
  ExerciseLibraryUpdateExerciseInput,
} from '@fitvo/validation';

import type { AccessTokenVerifier } from '../../shared/auth-context';
import { requireAuth } from '../../shared/auth-context';
import {
  ForbiddenError,
  InvalidLibraryItemNameError,
  LibraryItemNameConflictError,
  MuscleGroupUnavailableError,
  NotFoundError,
} from '../../shared/http-errors';
import type {
  ExerciseLibraryRepository,
  ExerciseRecord,
  MuscleGroupRecord,
  UpdateExerciseInput,
} from './exercise-library-repository';

function toMuscleGroupView(group: MuscleGroupRecord): ExerciseLibraryMuscleGroupView {
  return {
    id: group.id,
    code: group.code,
    name: group.name,
    displayOrder: group.displayOrder,
  };
}

function toExerciseView(exercise: ExerciseRecord): ExerciseLibraryExerciseView {
  return {
    id: exercise.id,
    name: exercise.name,
    description: exercise.description,
    videoStorageKey: exercise.videoStorageKey,
    visibility: exercise.visibility,
    status: exercise.status,
    specialtyId: exercise.specialtyId,
    ownerProfessionalProfileId: exercise.ownerProfessionalProfileId,
    primaryMuscleGroup: toMuscleGroupView(exercise.primaryMuscleGroup),
    secondaryMuscleGroups: exercise.secondaryMuscleGroups.map(toMuscleGroupView),
    createdAt: exercise.createdAt.toISOString(),
    updatedAt: exercise.updatedAt.toISOString(),
  };
}

/**
 * Servico de aplicacao da BIBLIOTECA DE EXERCICIOS (D-089/D-091/D-164, D-168 a
 * D-171 — ADR-0009).
 *
 * Tres regras de produto vivem aqui, nao no banco:
 *
 * 1. ESCOPO POR PROFISSIONAL (D-171) — o profissional enxerga PLATFORM + os
 *    PRIVATE dele. O tenant do path serve ao guard e ao contexto (D-150), nao
 *    ao filtro da biblioteca. Numa clinica, o item privado de um profissional
 *    NAO aparece para o outro.
 *
 * 2. DEFAULT SEGURO (D-170) — item de profissional nasce SEMPRE PRIVATE. O
 *    sistema NUNCA auto-promove nada para a base comum; a rota nem aceita
 *    `visibility`. Promover PRIVATE -> PLATFORM depende de um fluxo de
 *    curadoria que nenhum ADR decidiu — nao inventamos aqui.
 *
 * 3. ANTI-DUPLICACAO NORMALIZADA (D-169) — antes de criar, procura equivalente
 *    por nome NORMALIZADO e, se achar, DEVOLVE O EXISTENTE em vez de criar uma
 *    segunda linha. Nao e erro: e a decisao do ADR de oferecer o que ja existe.
 *
 * 4. DELECAO LOGICA (D-089) — descontinuar, nunca apagar.
 */
export class ExerciseLibraryApplicationService {
  constructor(
    private readonly library: ExerciseLibraryRepository,
    private readonly tokenVerifier: AccessTokenVerifier,
  ) {}

  async listMuscleGroups(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<ExerciseLibraryMuscleGroupView[]> {
    await this.requireProfessional(authorization, tenantId);
    const groups = await this.library.listMuscleGroups();
    return groups.map(toMuscleGroupView);
  }

  async listExercises(
    authorization: string | undefined,
    tenantId: string,
    query: ExerciseLibraryListQuery,
  ): Promise<ExerciseLibraryExerciseView[]> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    // A busca compara sobre a MESMA forma canonica que a coluna guarda (D-169):
    // procurar por "Supino" tem que achar "supino reto".
    const exercises = await this.library.listVisibleExercises(professionalProfileId, {
      searchNormalized: query.search ? normalizeLibraryItemName(query.search) : undefined,
      muscleGroupId: query.muscleGroupId,
      includeDiscontinued: query.includeDiscontinued,
    });
    return exercises.map(toExerciseView);
  }

  async getExercise(
    authorization: string | undefined,
    tenantId: string,
    exerciseId: string,
  ): Promise<ExerciseLibraryExerciseView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const exercise = await this.library.findVisibleExercise(professionalProfileId, exerciseId);
    if (!exercise) {
      throw new NotFoundError('Exercicio nao encontrado na sua biblioteca.');
    }
    return toExerciseView(exercise);
  }

  async createExercise(
    authorization: string | undefined,
    tenantId: string,
    input: ExerciseLibraryCreateExerciseInput,
  ): Promise<ExerciseLibraryCreateResult> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);

    const nameNormalized = normalizeLibraryItemName(input.name);
    if (nameNormalized.length === 0) {
      throw new InvalidLibraryItemNameError();
    }

    // D-169: o equivalente pode ser da base PLATFORM (comum a todos) ou um
    // PRIVATE que este mesmo profissional ja cadastrou. Nos dois casos,
    // devolvemos o existente em vez de duplicar.
    const equivalent = await this.library.findEquivalentByNormalizedName(
      professionalProfileId,
      nameNormalized,
    );
    if (equivalent) {
      return { outcome: 'DUPLICATE_FOUND', exercise: toExerciseView(equivalent) };
    }

    const secondaryMuscleGroupIds = dedupe(input.secondaryMuscleGroupIds ?? []).filter(
      (id) => id !== input.primaryMuscleGroupId,
    );
    await this.requireMuscleGroups([input.primaryMuscleGroupId, ...secondaryMuscleGroupIds]);

    const created = await this.library.createExercise({
      tenantId,
      ownerProfessionalProfileId: professionalProfileId,
      name: input.name.trim(),
      nameNormalized,
      primaryMuscleGroupId: input.primaryMuscleGroupId,
      secondaryMuscleGroupIds,
      description: input.description ?? null,
      specialtyId: input.specialtyId ?? null,
      videoStorageKey: input.videoStorageKey ?? null,
    });
    return { outcome: 'CREATED', exercise: toExerciseView(created) };
  }

  async updateExercise(
    authorization: string | undefined,
    tenantId: string,
    exerciseId: string,
    input: ExerciseLibraryUpdateExerciseInput,
  ): Promise<ExerciseLibraryExerciseView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    await this.requireOwnedExercise(professionalProfileId, exerciseId);

    const patch: UpdateExerciseInput = {
      description: input.description,
      videoStorageKey: input.videoStorageKey,
      primaryMuscleGroupId: input.primaryMuscleGroupId,
    };

    if (input.name !== undefined) {
      const nameNormalized = normalizeLibraryItemName(input.name);
      if (nameNormalized.length === 0) {
        throw new InvalidLibraryItemNameError();
      }
      // D-169 tambem na edicao: renomear para um nome que ja existe na
      // biblioteca visivel recriaria a duplicata que a criacao evitou.
      const equivalent = await this.library.findEquivalentByNormalizedName(
        professionalProfileId,
        nameNormalized,
      );
      if (equivalent && equivalent.id !== exerciseId) {
        throw new LibraryItemNameConflictError();
      }
      patch.name = input.name.trim();
      patch.nameNormalized = nameNormalized;
    }

    if (input.secondaryMuscleGroupIds !== undefined) {
      const primaryId = input.primaryMuscleGroupId;
      patch.secondaryMuscleGroupIds = dedupe(input.secondaryMuscleGroupIds).filter(
        (id) => id !== primaryId,
      );
    }

    const groupIdsToCheck = [
      ...(input.primaryMuscleGroupId === undefined ? [] : [input.primaryMuscleGroupId]),
      ...(patch.secondaryMuscleGroupIds ?? []),
    ];
    await this.requireMuscleGroups(groupIdsToCheck);

    const updated = await this.library.updateExercise(exerciseId, patch);
    return toExerciseView(updated);
  }

  /** Delecao LOGICA (D-089): sai da busca, continua valendo no historico. */
  async discontinueExercise(
    authorization: string | undefined,
    tenantId: string,
    exerciseId: string,
  ): Promise<ExerciseLibraryExerciseView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    await this.requireOwnedExercise(professionalProfileId, exerciseId);
    return toExerciseView(await this.library.discontinueExercise(exerciseId));
  }

  private async requireProfessional(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<{ professionalProfileId: string }> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const professional = await this.library.findProfessional(ctx.accountId, tenantId);
    if (!professional) {
      throw new ForbiddenError('Requer um perfil profissional neste tenant.');
    }
    return professional;
  }

  /**
   * Escrita so no que e DELE (D-171). Um item PLATFORM e visivel a todos mas
   * NAO editavel pelo profissional: a base comum nao se altera por fora de um
   * fluxo de curadoria (que nenhum ADR decidiu).
   */
  private async requireOwnedExercise(
    professionalProfileId: string,
    exerciseId: string,
  ): Promise<ExerciseRecord> {
    const exercise = await this.library.findVisibleExercise(professionalProfileId, exerciseId);
    if (!exercise) {
      throw new NotFoundError('Exercicio nao encontrado na sua biblioteca.');
    }
    if (exercise.ownerProfessionalProfileId !== professionalProfileId) {
      throw new ForbiddenError('Apenas o autor pode alterar um item da biblioteca.');
    }
    return exercise;
  }

  private async requireMuscleGroups(ids: string[]): Promise<void> {
    const unique = dedupe(ids);
    if (unique.length === 0) {
      return;
    }
    const found = await this.library.findMuscleGroupIds(unique);
    if (found.length !== unique.length) {
      throw new MuscleGroupUnavailableError();
    }
  }
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

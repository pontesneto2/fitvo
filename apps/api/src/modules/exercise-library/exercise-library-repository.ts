import type { LibraryItemStatus, LibraryVisibility } from '@fitvo/database';

/** Projecao de um grupo muscular do catalogo global (D-164). */
export interface MuscleGroupRecord {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
}

/** Projecao de um item da biblioteca, ja com a taxonomia resolvida (D-164). */
export interface ExerciseRecord {
  id: string;
  name: string;
  description: string | null;
  videoStorageKey: string | null;
  visibility: LibraryVisibility;
  status: LibraryItemStatus;
  specialtyId: string | null;
  ownerProfessionalProfileId: string | null;
  primaryMuscleGroup: MuscleGroupRecord;
  secondaryMuscleGroups: MuscleGroupRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExerciseInput {
  /** Tenant do profissional dono. Rastro/defesa em profundidade (D-166) — NAO e o eixo de visibilidade (D-171). */
  tenantId: string;
  ownerProfessionalProfileId: string;
  name: string;
  /** Derivado de `name` por `normalizeLibraryItemName` — nunca informado pelo chamador (D-169). */
  nameNormalized: string;
  primaryMuscleGroupId: string;
  secondaryMuscleGroupIds: string[];
  description: string | null;
  specialtyId: string | null;
  videoStorageKey: string | null;
}

export interface UpdateExerciseInput {
  name?: string | undefined;
  nameNormalized?: string | undefined;
  primaryMuscleGroupId?: string | undefined;
  secondaryMuscleGroupIds?: string[] | undefined;
  description?: string | null | undefined;
  videoStorageKey?: string | null | undefined;
}

export interface ListExercisesFilter {
  /** Nome ja normalizado (D-169): a busca compara sobre a MESMA forma canonica que a coluna guarda. */
  searchNormalized?: string | undefined;
  muscleGroupId?: string | undefined;
  /** Delecao logica (D-089): por padrao a busca so devolve ACTIVE. */
  includeDiscontinued?: boolean | undefined;
}

/**
 * Porta de persistencia da biblioteca de exercicios (Repository Pattern —
 * D-089/D-164/D-169/D-171 — ADR-0009).
 *
 * INVARIANTE DE ESCOPO (D-171): a biblioteca escopa por PROFISSIONAL, nao por
 * tenant. Toda leitura devolve a base PLATFORM (compartilhada, sem dono) MAIS
 * os itens PRIVATE do proprio profissional — nunca os PRIVATE de outro
 * profissional, mesmo que da mesma clinica. Isso e responsabilidade EXPLICITA
 * desta porta: a extension de isolamento de tenant NAO cobre `Exercise` (o item
 * PLATFORM tem `tenantId` NULL de proposito — ver tenant-isolation-extension.ts).
 */
export interface ExerciseLibraryRepository {
  /** Perfil profissional do chamador neste tenant — guard de toda operacao. */
  findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null>;

  /** Catalogo global de grupos musculares, so os ACTIVE, na ordem de exibicao (D-164/D-089). */
  listMuscleGroups(): Promise<MuscleGroupRecord[]>;

  /** Os ids informados existem e estao ACTIVE no catalogo? Guard de criacao/edicao. */
  findMuscleGroupIds(ids: string[]): Promise<string[]>;

  /** A biblioteca VISIVEL ao profissional: PLATFORM + os PRIVATE dele (D-171). */
  listVisibleExercises(
    professionalProfileId: string,
    filter: ListExercisesFilter,
  ): Promise<ExerciseRecord[]>;

  /** Um item da biblioteca visivel ao profissional; `null` se nao existir ou for de outro dono. */
  findVisibleExercise(
    professionalProfileId: string,
    exerciseId: string,
  ): Promise<ExerciseRecord | null>;

  /**
   * Anti-duplicacao normalizada (D-169). Procura, pelo nome JA NORMALIZADO, um
   * equivalente no que este profissional enxerga: primeiro na base PLATFORM
   * (comum a todos), depois nos PRIVATE dele. Devolve `null` quando nao ha
   * equivalente. Ignora `status` de proposito: reoferecer um item que o proprio
   * profissional descontinuou e melhor do que criar uma segunda linha com o
   * mesmo nome.
   */
  findEquivalentByNormalizedName(
    professionalProfileId: string,
    nameNormalized: string,
  ): Promise<ExerciseRecord | null>;

  createExercise(input: CreateExerciseInput): Promise<ExerciseRecord>;

  /** Atualiza um item PRIVATE do proprio profissional (guard aplicado no service). */
  updateExercise(exerciseId: string, input: UpdateExerciseInput): Promise<ExerciseRecord>;

  /**
   * Delecao LOGICA (D-089): marca DISCONTINUED. Nunca DELETE fisico — o item
   * sai da busca mas segue funcionando nos treinos que ja o usam.
   */
  discontinueExercise(exerciseId: string): Promise<ExerciseRecord>;
}

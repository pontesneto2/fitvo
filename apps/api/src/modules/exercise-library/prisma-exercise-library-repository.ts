import type { Prisma, PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import type {
  CreateExerciseInput,
  ExerciseLibraryRepository,
  ExerciseRecord,
  ListExercisesFilter,
  MuscleGroupRecord,
  UpdateExerciseInput,
} from './exercise-library-repository';

const MUSCLE_GROUP_PROJECTION = {
  id: true,
  code: true,
  name: true,
  displayOrder: true,
} as const;

const EXERCISE_PROJECTION = {
  id: true,
  name: true,
  description: true,
  videoStorageKey: true,
  visibility: true,
  status: true,
  specialtyId: true,
  ownerProfessionalProfileId: true,
  primaryMuscleGroup: { select: MUSCLE_GROUP_PROJECTION },
  secondaryMuscleGroups: {
    select: { muscleGroup: { select: MUSCLE_GROUP_PROJECTION } },
    orderBy: { muscleGroup: { displayOrder: 'asc' } },
  },
  createdAt: true,
  updatedAt: true,
} as const;

type ExerciseRow = Prisma.ExerciseGetPayload<{ select: typeof EXERCISE_PROJECTION }>;

function toRecord(row: ExerciseRow): ExerciseRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    videoStorageKey: row.videoStorageKey,
    visibility: row.visibility,
    status: row.status,
    specialtyId: row.specialtyId,
    ownerProfessionalProfileId: row.ownerProfessionalProfileId,
    primaryMuscleGroup: row.primaryMuscleGroup,
    secondaryMuscleGroups: row.secondaryMuscleGroups.map((link) => link.muscleGroup),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * O QUE O PROFISSIONAL ENXERGA (D-171): a base PLATFORM (sem dono) MAIS os
 * itens PRIVATE dele. Este predicado e o CORACAO do escopo da biblioteca e a
 * razao pela qual `Exercise` NAO entra em TENANT_SCOPED_MODELS: a extension de
 * isolamento so sabe filtrar por `tenantId = <contexto>`, o que apagaria a base
 * PLATFORM (que tem `tenantId` NULL de proposito — D-089) e ainda assim NAO
 * separaria dois profissionais do MESMO tenant, que e a separacao que o D-171
 * exige. O eixo aqui e dono/visibilidade, nao tenant.
 */
function visibleToProfessional(professionalProfileId: string): Prisma.ExerciseWhereInput {
  return {
    OR: [
      { visibility: 'PLATFORM' },
      { visibility: 'PRIVATE', ownerProfessionalProfileId: professionalProfileId },
    ],
  };
}

/** Implementacao Prisma (infra) da biblioteca de exercicios (ADR-0009). */
export class PrismaExerciseLibraryRepository implements ExerciseLibraryRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null> {
    const profile = await this.db.professionalProfile.findFirst({
      where: { accountId, tenantId },
      select: { id: true },
    });
    return profile ? { professionalProfileId: profile.id } : null;
  }

  listMuscleGroups(): Promise<MuscleGroupRecord[]> {
    return this.db.muscleGroup.findMany({
      where: { status: 'ACTIVE' },
      select: MUSCLE_GROUP_PROJECTION,
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async findMuscleGroupIds(ids: string[]): Promise<string[]> {
    const found = await this.db.muscleGroup.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      select: { id: true },
    });
    return found.map((group) => group.id);
  }

  async listVisibleExercises(
    professionalProfileId: string,
    filter: ListExercisesFilter,
  ): Promise<ExerciseRecord[]> {
    const where: Prisma.ExerciseWhereInput = {
      AND: [
        visibleToProfessional(professionalProfileId),
        // Delecao logica (D-089): DISCONTINUED some da busca por padrao.
        ...(filter.includeDiscontinued === true
          ? []
          : [{ status: 'ACTIVE' as const } satisfies Prisma.ExerciseWhereInput]),
        // Busca sobre a coluna NORMALIZADA (D-169) — `contains` sem `mode:
        // insensitive` porque a coluna ja e a forma canonica minuscula/sem
        // acento; comparar cru aqui e o que faz "Supino" achar "supino reto".
        ...(filter.searchNormalized === undefined
          ? []
          : [
              {
                nameNormalized: { contains: filter.searchNormalized },
              } satisfies Prisma.ExerciseWhereInput,
            ]),
        ...(filter.muscleGroupId === undefined
          ? []
          : [
              {
                OR: [
                  { primaryMuscleGroupId: filter.muscleGroupId },
                  { secondaryMuscleGroups: { some: { muscleGroupId: filter.muscleGroupId } } },
                ],
              } satisfies Prisma.ExerciseWhereInput,
            ]),
      ],
    };

    const rows = await this.db.exercise.findMany({
      where,
      select: EXERCISE_PROJECTION,
      orderBy: { nameNormalized: 'asc' },
    });
    return rows.map(toRecord);
  }

  async findVisibleExercise(
    professionalProfileId: string,
    exerciseId: string,
  ): Promise<ExerciseRecord | null> {
    const row = await this.db.exercise.findFirst({
      where: { AND: [{ id: exerciseId }, visibleToProfessional(professionalProfileId)] },
      select: EXERCISE_PROJECTION,
    });
    return row ? toRecord(row) : null;
  }

  async findEquivalentByNormalizedName(
    professionalProfileId: string,
    nameNormalized: string,
  ): Promise<ExerciseRecord | null> {
    // A base PLATFORM vence a PRIVATE quando as duas casam: o D-169 quer que a
    // base COMUM seja oferecida antes do item proprio.
    const row = await this.db.exercise.findFirst({
      where: {
        AND: [{ nameNormalized }, visibleToProfessional(professionalProfileId)],
      },
      select: EXERCISE_PROJECTION,
      orderBy: { visibility: 'asc' }, // PLATFORM antes de PRIVATE (ordem do enum)
    });
    return row ? toRecord(row) : null;
  }

  async createExercise(input: CreateExerciseInput): Promise<ExerciseRecord> {
    const row = await this.db.exercise.create({
      data: {
        tenantId: input.tenantId,
        ownerProfessionalProfileId: input.ownerProfessionalProfileId,
        primaryMuscleGroupId: input.primaryMuscleGroupId,
        name: input.name,
        nameNormalized: input.nameNormalized,
        description: input.description,
        specialtyId: input.specialtyId,
        videoStorageKey: input.videoStorageKey,
        // D-170 — default seguro: item de profissional nasce PRIVATE. Explicito
        // aqui (e nao so no default da coluna) para a regra ficar legivel no
        // ponto onde ela vale.
        visibility: 'PRIVATE',
        secondaryMuscleGroups: {
          create: input.secondaryMuscleGroupIds.map((muscleGroupId) => ({ muscleGroupId })),
        },
      },
      select: EXERCISE_PROJECTION,
    });
    return toRecord(row);
  }

  async updateExercise(exerciseId: string, input: UpdateExerciseInput): Promise<ExerciseRecord> {
    // Transacao porque trocar os secundarios sao DUAS escritas (apagar os
    // vinculos antigos, criar os novos) que precisam cair juntas com o UPDATE
    // do proprio item — meio caminho deixaria a taxonomia incoerente (D-164).
    const row = await this.db.$transaction(async (tx) => {
      if (input.secondaryMuscleGroupIds !== undefined) {
        await tx.exerciseSecondaryMuscleGroup.deleteMany({ where: { exerciseId } });
        if (input.secondaryMuscleGroupIds.length > 0) {
          await tx.exerciseSecondaryMuscleGroup.createMany({
            data: input.secondaryMuscleGroupIds.map((muscleGroupId) => ({
              exerciseId,
              muscleGroupId,
            })),
          });
        }
      }
      // Campos ausentes sao OMITIDOS do `data` (em vez de irem como
      // `undefined`): sob `exactOptionalPropertyTypes`, um `undefined`
      // explicito nao e o mesmo que "nao mexa neste campo" para o Prisma.
      const data: Prisma.ExerciseUpdateInput = {};
      if (input.name !== undefined) {
        data.name = input.name;
      }
      if (input.nameNormalized !== undefined) {
        data.nameNormalized = input.nameNormalized;
      }
      if (input.primaryMuscleGroupId !== undefined) {
        data.primaryMuscleGroup = { connect: { id: input.primaryMuscleGroupId } };
      }
      if (input.description !== undefined) {
        data.description = input.description;
      }
      if (input.videoStorageKey !== undefined) {
        data.videoStorageKey = input.videoStorageKey;
      }
      return tx.exercise.update({
        where: { id: exerciseId },
        data,
        select: EXERCISE_PROJECTION,
      });
    });
    return toRecord(row);
  }

  async discontinueExercise(exerciseId: string): Promise<ExerciseRecord> {
    // D-089: NUNCA delete fisico — so a troca de status.
    const row = await this.db.exercise.update({
      where: { id: exerciseId },
      data: { status: 'DISCONTINUED' },
      select: EXERCISE_PROJECTION,
    });
    return toRecord(row);
  }
}

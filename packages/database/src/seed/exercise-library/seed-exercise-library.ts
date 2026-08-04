import { readFileSync } from 'node:fs';

import { type FreeExerciseDbRecord, isFreeExerciseDbRecord } from './free-exercise-db-source';
import { mapFreeExerciseDb, type MappedExercise, type MappingReport } from './map-free-exercise-db';

/**
 * Escritor do seed da BIBLIOTECA PLATFORM de exercícios (D-089 — ADR-0009).
 *
 * Três invariantes, e as três são o motivo de este arquivo existir separado do
 * mapeador:
 *
 * 1. **PLATFORM, global.** `visibility = PLATFORM`, `tenantId = NULL`,
 *    `ownerProfessionalProfileId = NULL`. O `tenantId` nulo é o que torna a
 *    base visível a TODOS os tenants (D-089/D-171) — e é por causa dele que
 *    `Exercise` não entra em `TENANT_SCOPED_MODELS`. Consequência prática: este
 *    seed precisa de um client SEM a extension de isolamento, senão ela
 *    sobrescreveria `tenantId` e a base deixaria de ser global.
 *
 * 2. **Idempotente por nome normalizado (D-169).** Rodar duas vezes não cria
 *    1.746 exercícios. A checagem é por `nameNormalized` — a mesma normalização
 *    canônica que a API usa (`normalizeLibraryItemName`), não igualdade
 *    literal de string.
 *
 * 3. **Nunca apaga nem sobrescreve.** Só INSERE o que falta. Um exercício
 *    PLATFORM já existente fica como está, inclusive se um humano tiver
 *    corrigido a tradução à mão — o seed não pode desfazer curadoria.
 */

/** Subconjunto do PrismaClient de que o seed precisa. Injetável para teste. */
export interface SeedPrismaClient {
  muscleGroup: {
    findMany(args: {
      select: { id: true; code: true };
    }): Promise<Array<{ id: string; code: string }>>;
  };
  specialty: {
    findUnique(args: {
      where: { code: 'TRAINING' };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  exercise: {
    findMany(args: {
      where: { visibility: 'PLATFORM'; nameNormalized: { in: string[] } };
      select: { nameNormalized: true };
    }): Promise<Array<{ nameNormalized: string }>>;
    create(args: { data: unknown }): Promise<unknown>;
  };
}

export interface SeedResult {
  /** Exercícios criados nesta execução. */
  inserted: number;
  /** Já existentes na base PLATFORM — pulados (prova da idempotência). */
  skippedExisting: number;
  /** Total de exercícios PLATFORM esperados após a execução. */
  totalAfter: number;
  report: MappingReport;
  /** `null` quando a especialidade TRAINING não está seedada. */
  specialtyId: string | null;
}

/** Lê e valida o JSON-fonte congelado. */
export function loadFreeExerciseDb(filePath: string | URL): FreeExerciseDbRecord[] {
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('free-exercise-db: esperado um array no JSON-fonte.');
  }
  const records = parsed.filter(isFreeExerciseDbRecord);
  if (records.length !== parsed.length) {
    throw new Error(
      `free-exercise-db: ${parsed.length - records.length} registro(s) fora do formato esperado.`,
    );
  }
  return records;
}

/** Caminho do JSON-fonte versionado (ver `seed/free-exercise-db/SOURCE.md`). */
export const FREE_EXERCISE_DB_PATH = new URL(
  '../../../seed/free-exercise-db/exercises.json',
  import.meta.url,
);

export async function seedExerciseLibrary(
  prisma: SeedPrismaClient,
  source: readonly FreeExerciseDbRecord[],
): Promise<SeedResult> {
  const { exercises, report } = mapFreeExerciseDb(source);

  // ── Catálogo de músculo ────────────────────────────────────────────────
  const muscleGroups = await prisma.muscleGroup.findMany({
    select: { id: true, code: true },
  });
  const muscleGroupIdByCode = new Map(muscleGroups.map((group) => [group.code, group.id]));

  // Falha ALTO e cedo: um código ausente significa que o catálogo do #131 não
  // foi aplicado, e inserir mesmo assim quebraria a FK no meio do lote,
  // deixando a base pela metade. Melhor não começar.
  const requiredCodes = new Set<string>();
  for (const exercise of exercises) {
    requiredCodes.add(exercise.primaryMuscleGroupCode);
    for (const code of exercise.secondaryMuscleGroupCodes) requiredCodes.add(code);
  }
  const missingCodes = [...requiredCodes].filter((code) => !muscleGroupIdByCode.has(code));
  if (missingCodes.length > 0) {
    throw new Error(
      `MuscleGroup ausente(s) no catálogo: ${missingCodes.join(', ')}. ` +
        'Aplique as migrations antes de rodar o seed.',
    );
  }

  // ── Especialidade (estrutural, opcional) ───────────────────────────────
  const specialty = await prisma.specialty.findUnique({
    where: { code: 'TRAINING' },
    select: { id: true },
  });
  const specialtyId = specialty?.id ?? null;

  // ── Anti-duplicação normalizada (D-169) ────────────────────────────────
  const existing = await prisma.exercise.findMany({
    where: {
      visibility: 'PLATFORM',
      nameNormalized: { in: exercises.map((exercise) => exercise.nameNormalized) },
    },
    select: { nameNormalized: true },
  });
  const existingNames = new Set(existing.map((row) => row.nameNormalized));

  const pending = exercises.filter((exercise) => !existingNames.has(exercise.nameNormalized));

  for (const exercise of pending) {
    await prisma.exercise.create({
      data: buildCreateData(exercise, muscleGroupIdByCode, specialtyId),
    });
  }

  return {
    inserted: pending.length,
    skippedExisting: exercises.length - pending.length,
    totalAfter: exercises.length,
    report,
    specialtyId,
  };
}

function buildCreateData(
  exercise: MappedExercise,
  muscleGroupIdByCode: ReadonlyMap<string, string>,
  specialtyId: string | null,
): Record<string, unknown> {
  const primaryMuscleGroupId = muscleGroupIdByCode.get(exercise.primaryMuscleGroupCode);
  if (primaryMuscleGroupId === undefined) {
    throw new Error(
      `MuscleGroup ${exercise.primaryMuscleGroupCode} ausente (${exercise.englishName}).`,
    );
  }

  return {
    // Base GLOBAL: sem tenant e sem dono — é isto que a torna visível a todos
    // os profissionais de todos os tenants (D-089/D-171).
    tenantId: null,
    ownerProfessionalProfileId: null,
    specialtyId,
    visibility: 'PLATFORM',
    status: 'ACTIVE',
    name: exercise.name,
    nameNormalized: exercise.nameNormalized,
    description: exercise.description,
    // Sem vídeo: a fonte só tem imagem estática, e o schema só tem chave de
    // VÍDEO (D-091). Ver `map-free-exercise-db.ts` / `SOURCE.md`.
    videoStorageKey: null,
    primaryMuscleGroupId,
    secondaryMuscleGroups: {
      create: exercise.secondaryMuscleGroupCodes.map((code) => ({
        muscleGroupId: muscleGroupIdByCode.get(code),
      })),
    },
  };
}

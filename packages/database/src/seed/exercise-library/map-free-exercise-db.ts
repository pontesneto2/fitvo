import { normalizeLibraryItemName } from '../../normalize-library-item-name';
import { type EquipmentMapping, mapSourceEquipment } from './equipment-map';
import type { FreeExerciseDbRecord } from './free-exercise-db-source';
import { FALLBACK_MUSCLE_GROUP_CODE, mapSourceMuscle } from './muscle-group-map';
import { translateExerciseName, type TranslationStrategy } from './translate-exercise-name';

/**
 * Mapeamento PURO free-exercise-db → registro de `Exercise` do FITVO.
 *
 * Sem banco, sem I/O: recebe os registros da fonte, devolve o que deve ser
 * gravado MAIS um relatório do que não coube. Separado do escritor
 * (`seed-exercise-library.ts`) de propósito — é aqui que moram as regras de
 * negócio do import, e regra de negócio se testa sem Postgres.
 */

/** Campos da fonte que o schema atual NÃO tem onde guardar. Ver `unstoredNote`. */
export interface UnstoredSourceFields {
  /** `beginner` | `intermediate` | `expert` — sem coluna em `Exercise`. */
  level: string;
  /** `push` | `pull` | `static` | null — sem coluna. */
  force: string | null;
  /** `compound` | `isolation` | null — sem coluna. */
  mechanic: string | null;
  /** `strength` | `stretching` | ... — sem coluna. */
  category: string;
  /** Mapeado para o catálogo do D-187, mas sem coluna onde gravar. */
  equipment: EquipmentMapping | null;
  /**
   * Caminhos das imagens NA FONTE (relativos ao repo free-exercise-db).
   * NÃO são importadas: o schema só tem `videoStorageKey` (vídeo — D-091) e
   * hotlinkar `raw.githubusercontent.com` em produção está fora de questão.
   */
  imageSourcePaths: string[];
}

/** Um exercício pronto para virar linha de `Exercise`. */
export interface MappedExercise {
  /** `id` na fonte — rastro de proveniência, não vai para o banco. */
  sourceId: string;
  /** Nome original em inglês — rastro para auditoria da tradução. */
  englishName: string;
  /** Nome final (pt-BR quando traduzido; inglês quando não houve tradução). */
  name: string;
  nameTranslation: TranslationStrategy;
  /** Derivado de `name` por `normalizeLibraryItemName` — D-169. */
  nameNormalized: string;
  /** Instruções de execução, unidas. `null` quando a fonte não trouxe nenhuma. */
  description: string | null;
  /**
   * Idioma de `description`. Hoje SEMPRE `en`: não há caminho de tradução
   * automática de texto corrido disponível (ver `translate-exercise-name.ts`).
   * O campo existe para o passe de tradução futuro saber o que reprocessar.
   */
  descriptionLocale: 'pt-BR' | 'en';
  primaryMuscleGroupCode: string;
  /** Já deduplicado e SEM o primário — ver `muscle-group-map.ts`. */
  secondaryMuscleGroupCodes: string[];
  /** `true` quando o primário caiu no grupo genérico por falta de mapeamento. */
  usedFallbackPrimaryMuscle: boolean;
  unstored: UnstoredSourceFields;
}

export interface OccurrenceCount {
  value: string;
  count: number;
}

export interface MappingReport {
  /** Registros lidos da fonte. */
  totalSource: number;
  /** Registros mapeados (após descartar duplicata normalizada interna). */
  totalMapped: number;
  /**
   * Descartados por colidirem, DENTRO DA PRÓPRIA FONTE, no nome normalizado.
   * Acontece de verdade: "Pushups" e "Push-Ups" traduzem para o mesmo "Flexão
   * de braço". Sem este descarte o próprio seed violaria o D-169 na primeira
   * execução.
   */
  duplicatesWithinSource: Array<{ kept: string; dropped: string; nameNormalized: string }>;
  /** Músculos da fonte sem correspondente no catálogo FITVO. */
  unmappedMuscles: OccurrenceCount[];
  /** Equipamentos da fonte sem correspondente exato no catálogo D-187. */
  inexactEquipment: OccurrenceCount[];
  /** Equipamentos da fonte que o de-para não conhece (nenhum, se tudo mapeado). */
  unmappedEquipment: OccurrenceCount[];
  translation: {
    curated: number;
    compositional: number;
    untranslated: number;
    /** Nomes que seguem em inglês — a lista de trabalho da curadoria futura. */
    untranslatedNames: string[];
  };
  /** Nulos na fonte, provando que campo incompleto não quebrou o import. */
  nullSourceFields: { force: number; mechanic: number; equipment: number };
  /** Exercícios sem descrição na fonte. */
  withoutDescription: number;
  /** Imagens vistas na fonte e NÃO importadas (não há coluna). */
  imagesNotImported: number;
}

export interface MappingResult {
  exercises: MappedExercise[];
  report: MappingReport;
}

function tally(values: readonly string[]): OccurrenceCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * Mapeia um registro da fonte. `null` só quando não há músculo primário
 * utilizável E nem fallback — hoje impossível (o fallback é incondicional),
 * mas a assinatura mantém a porta aberta sem exigir exceção.
 */
function mapOne(record: FreeExerciseDbRecord, unmappedMuscles: string[]): MappedExercise {
  const translated = translateExerciseName(record.name);

  const sourcePrimary = record.primaryMuscles[0];
  let primaryCode: string | null = null;
  if (sourcePrimary !== undefined) {
    primaryCode = mapSourceMuscle(sourcePrimary);
    if (primaryCode === null) unmappedMuscles.push(sourcePrimary);
  }
  const usedFallbackPrimaryMuscle = primaryCode === null;
  const primaryMuscleGroupCode = primaryCode ?? FALLBACK_MUSCLE_GROUP_CODE;

  // Secundários: o catálogo FITVO é mais grosso que o da fonte, então dois
  // músculos podem colapsar no mesmo grupo — e o primário pode reaparecer
  // entre os secundários. Deduplicar e remover o primário não é polimento: sem
  // isso a PK de ExerciseSecondaryMuscleGroup seria violada.
  const secondaryCodes = new Set<string>();
  for (const muscle of record.secondaryMuscles) {
    const code = mapSourceMuscle(muscle);
    if (code === null) {
      unmappedMuscles.push(muscle);
      continue;
    }
    if (code === primaryMuscleGroupCode) continue;
    secondaryCodes.add(code);
  }

  const instructions = record.instructions.map((line) => line.trim()).filter((line) => line !== '');

  return {
    sourceId: record.id,
    englishName: record.name,
    name: translated.name,
    nameTranslation: translated.strategy,
    nameNormalized: normalizeLibraryItemName(translated.name),
    description: instructions.length > 0 ? instructions.join('\n\n') : null,
    descriptionLocale: 'en',
    primaryMuscleGroupCode,
    secondaryMuscleGroupCodes: [...secondaryCodes],
    usedFallbackPrimaryMuscle,
    unstored: {
      level: record.level,
      force: record.force,
      mechanic: record.mechanic,
      category: record.category,
      equipment: mapSourceEquipment(record.equipment),
      imageSourcePaths: record.images,
    },
  };
}

export function mapFreeExerciseDb(source: readonly FreeExerciseDbRecord[]): MappingResult {
  const unmappedMuscles: string[] = [];
  const inexactEquipment: string[] = [];
  const unmappedEquipment: string[] = [];
  const duplicatesWithinSource: MappingReport['duplicatesWithinSource'] = [];

  const exercises: MappedExercise[] = [];
  const byNormalizedName = new Map<string, MappedExercise>();

  for (const record of source) {
    const mapped = mapOne(record, unmappedMuscles);

    if (record.equipment !== null && mapSourceEquipment(record.equipment) === null) {
      unmappedEquipment.push(record.equipment);
    } else if (mapped.unstored.equipment?.exact === false) {
      inexactEquipment.push(record.equipment ?? '(nulo)');
    }

    const clash = byNormalizedName.get(mapped.nameNormalized);
    if (clash !== undefined) {
      duplicatesWithinSource.push({
        kept: clash.englishName,
        dropped: mapped.englishName,
        nameNormalized: mapped.nameNormalized,
      });
      continue;
    }
    byNormalizedName.set(mapped.nameNormalized, mapped);
    exercises.push(mapped);
  }

  const strategyCount = (strategy: TranslationStrategy): number =>
    exercises.filter((exercise) => exercise.nameTranslation === strategy).length;

  return {
    exercises,
    report: {
      totalSource: source.length,
      totalMapped: exercises.length,
      duplicatesWithinSource,
      unmappedMuscles: tally(unmappedMuscles),
      inexactEquipment: tally(inexactEquipment),
      unmappedEquipment: tally(unmappedEquipment),
      translation: {
        curated: strategyCount('CURATED'),
        compositional: strategyCount('COMPOSITIONAL'),
        untranslated: strategyCount('UNTRANSLATED'),
        untranslatedNames: exercises
          .filter((exercise) => exercise.nameTranslation === 'UNTRANSLATED')
          .map((exercise) => exercise.englishName),
      },
      nullSourceFields: {
        force: source.filter((record) => record.force === null).length,
        mechanic: source.filter((record) => record.mechanic === null).length,
        equipment: source.filter((record) => record.equipment === null).length,
      },
      withoutDescription: exercises.filter((exercise) => exercise.description === null).length,
      imagesNotImported: source.reduce((total, record) => total + record.images.length, 0),
    },
  };
}

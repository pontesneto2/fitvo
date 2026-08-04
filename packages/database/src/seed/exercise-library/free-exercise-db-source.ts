/**
 * Tipos do dataset free-exercise-db (domínio público — ver
 * `seed/free-exercise-db/SOURCE.md`).
 *
 * `force`, `mechanic` e `equipment` são NULÁVEIS de propósito: a fonte traz 29,
 * 87 e 77 registros sem esses campos. Tipar como opcional é o que impede o
 * mapeador de assumir preenchido — o import não pode quebrar por dado ausente
 * numa fonte de terceiro que nunca prometeu completude.
 */
export interface FreeExerciseDbRecord {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

/** Guarda de runtime: a fonte é JSON externo, não um módulo tipado nosso. */
export function isFreeExerciseDbRecord(value: unknown): value is FreeExerciseDbRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.level === 'string' &&
    typeof record.category === 'string' &&
    Array.isArray(record.primaryMuscles) &&
    Array.isArray(record.secondaryMuscles) &&
    Array.isArray(record.instructions) &&
    Array.isArray(record.images)
  );
}

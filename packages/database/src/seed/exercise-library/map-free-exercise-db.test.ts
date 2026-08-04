import { describe, expect, it } from 'vitest';

import type { FreeExerciseDbRecord } from './free-exercise-db-source';
import { mapFreeExerciseDb } from './map-free-exercise-db';
import { FALLBACK_MUSCLE_GROUP_CODE } from './muscle-group-map';

function record(overrides: Partial<FreeExerciseDbRecord> = {}): FreeExerciseDbRecord {
  return {
    id: 'Barbell_Squat',
    name: 'Barbell Squat',
    force: 'push',
    level: 'intermediate',
    mechanic: 'compound',
    equipment: 'barbell',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes'],
    instructions: ['Passo um.', 'Passo dois.'],
    category: 'strength',
    images: ['Barbell_Squat/0.jpg'],
    ...overrides,
  };
}

describe('mapFreeExerciseDb — músculo', () => {
  it('mapeia primário e secundários para códigos do catálogo FITVO', () => {
    const { exercises } = mapFreeExerciseDb([record()]);
    expect(exercises[0]?.primaryMuscleGroupCode).toBe('QUADRICEPS');
    expect(exercises[0]?.secondaryMuscleGroupCodes).toEqual(['GLUTEO']);
    expect(exercises[0]?.usedFallbackPrimaryMuscle).toBe(false);
  });

  it('colapsa músculos distintos que caem no mesmo grupo, sem duplicar', () => {
    // `lats` e `middle back` são AMBOS COSTAS no catálogo FITVO.
    const { exercises } = mapFreeExerciseDb([
      record({ primaryMuscles: ['chest'], secondaryMuscles: ['lats', 'middle back'] }),
    ]);
    expect(exercises[0]?.secondaryMuscleGroupCodes).toEqual(['COSTAS']);
  });

  it('remove dos secundários o grupo que já é o primário', () => {
    // Sem isso a PK de ExerciseSecondaryMuscleGroup seria violada na inserção.
    const { exercises } = mapFreeExerciseDb([
      record({ primaryMuscles: ['lats'], secondaryMuscles: ['middle back'] }),
    ]);
    expect(exercises[0]?.primaryMuscleGroupCode).toBe('COSTAS');
    expect(exercises[0]?.secondaryMuscleGroupCodes).toEqual([]);
  });

  it('aproxima `neck` para TRAPEZIO — e não conta como não-mapeado', () => {
    const { exercises, report } = mapFreeExerciseDb([
      record({ primaryMuscles: ['neck'], secondaryMuscles: [] }),
    ]);
    expect(exercises[0]?.primaryMuscleGroupCode).toBe('TRAPEZIO');
    expect(report.unmappedMuscles).toEqual([]);
  });

  it('cai no grupo genérico e REPORTA quando o músculo é desconhecido', () => {
    const { exercises, report } = mapFreeExerciseDb([
      record({ primaryMuscles: ['tail'], secondaryMuscles: [] }),
    ]);
    expect(exercises[0]?.primaryMuscleGroupCode).toBe(FALLBACK_MUSCLE_GROUP_CODE);
    expect(exercises[0]?.usedFallbackPrimaryMuscle).toBe(true);
    expect(report.unmappedMuscles).toEqual([{ value: 'tail', count: 1 }]);
  });
});

describe('mapFreeExerciseDb — dado incompleto da fonte não quebra o import', () => {
  it('aceita force, mechanic e equipment nulos', () => {
    const { exercises, report } = mapFreeExerciseDb([
      record({ force: null, mechanic: null, equipment: null }),
    ]);
    expect(exercises).toHaveLength(1);
    // equipment nulo = peso corporal, não "desconhecido".
    expect(exercises[0]?.unstored.equipment?.code).toBe('NENHUM');
    expect(report.nullSourceFields).toEqual({ force: 1, mechanic: 1, equipment: 1 });
  });

  it('aceita ausência de instruções — description vira null, não string vazia', () => {
    const { exercises, report } = mapFreeExerciseDb([record({ instructions: [] })]);
    expect(exercises[0]?.description).toBeNull();
    expect(report.withoutDescription).toBe(1);
  });

  it('marca equipamento sem item exato no catálogo D-187 como "outro"', () => {
    const { exercises, report } = mapFreeExerciseDb([record({ equipment: 'medicine ball' })]);
    expect(exercises[0]?.unstored.equipment?.exact).toBe(false);
    expect(report.inexactEquipment).toEqual([{ value: 'medicine ball', count: 1 }]);
  });
});

describe('mapFreeExerciseDb — anti-duplicação (D-169)', () => {
  it('descarta a segunda ocorrência quando o nome normalizado colide', () => {
    // "Pushups" e "Push-Ups" traduzem para o mesmo "Flexão de braço": sem este
    // descarte o próprio seed nasceria duplicado.
    const { exercises, report } = mapFreeExerciseDb([
      record({ id: 'a', name: 'Pushups', primaryMuscles: ['chest'] }),
      record({ id: 'b', name: 'Push-Ups', primaryMuscles: ['chest'] }),
    ]);
    expect(exercises).toHaveLength(1);
    expect(report.duplicatesWithinSource).toHaveLength(1);
    expect(report.duplicatesWithinSource[0]?.dropped).toBe('Push-Ups');
  });

  it('deriva nameNormalized do nome FINAL (pt-BR), não do inglês', () => {
    const { exercises } = mapFreeExerciseDb([record()]);
    expect(exercises[0]?.name).toBe('Agachamento livre com barra');
    expect(exercises[0]?.nameNormalized).toBe('agachamento livre com barra');
  });
});

describe('mapFreeExerciseDb — o que o schema não guarda', () => {
  it('preserva os campos sem coluna no bloco `unstored`, sem inventar coluna', () => {
    const { exercises } = mapFreeExerciseDb([record()]);
    const unstored = exercises[0]?.unstored;
    expect(unstored?.level).toBe('intermediate');
    expect(unstored?.force).toBe('push');
    expect(unstored?.mechanic).toBe('compound');
    expect(unstored?.category).toBe('strength');
    expect(unstored?.imageSourcePaths).toEqual(['Barbell_Squat/0.jpg']);
  });

  it('marca as instruções como inglês — é o rastro do passe de tradução futuro', () => {
    const { exercises } = mapFreeExerciseDb([record()]);
    expect(exercises[0]?.descriptionLocale).toBe('en');
    expect(exercises[0]?.description).toBe('Passo um.\n\nPasso dois.');
  });
});

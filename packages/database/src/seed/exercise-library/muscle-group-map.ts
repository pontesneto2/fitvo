/**
 * De-para MÚSCULO (free-exercise-db, inglês) → `MuscleGroup.code` do FITVO
 * (D-164 — ADR-0009). Explícito e exaustivo de propósito: a fonte tem
 * exatamente 17 valores distintos e o catálogo do FITVO tem 16 grupos
 * (migration `20260803120000_treino_muscle_group_e_tenant_retrofit`).
 *
 * Duas observações que o de-para carrega e o import precisa respeitar:
 *
 * 1. NÃO é bijetor. `lats` e `middle back` colapsam ambos em `COSTAS` — o
 *    catálogo do FITVO é mais grosso que o da fonte de propósito (o personal
 *    prescreve por grupo, não por cabeça muscular). Por isso o mapeador precisa
 *    DEDUPLICAR os secundários e remover deles o primário: sem isso, "Pulldown"
 *    (primário `lats`, secundário `middle back`) tentaria gravar COSTAS como
 *    secundário de si mesmo e violaria a PK de `ExerciseSecondaryMuscleGroup`.
 *
 * 2. `neck` é o ÚNICO músculo sem correspondente exato: o FITVO não tem grupo
 *    "pescoço". Mapeado para o mais próximo (`TRAPEZIO` — o trapézio superior é
 *    o grupo que os exercícios de pescoço da fonte de fato recrutam) e marcado
 *    em `INEXACT_MUSCLE_MAPPINGS` para que o relatório do seed o exiba em vez
 *    de escondê-lo. Se algum dia existir um grupo PESCOCO, é aqui que muda.
 */
export const MUSCLE_GROUP_CODE_BY_SOURCE_MUSCLE: Readonly<Record<string, string>> = {
  abdominals: 'ABDOMEN',
  abductors: 'ABDUTORES',
  adductors: 'ADUTORES',
  biceps: 'BICEPS',
  calves: 'PANTURRILHA',
  chest: 'PEITO',
  forearms: 'ANTEBRACO',
  glutes: 'GLUTEO',
  hamstrings: 'POSTERIOR_COXA',
  lats: 'COSTAS',
  'lower back': 'LOMBAR',
  'middle back': 'COSTAS',
  neck: 'TRAPEZIO', // aproximação — ver INEXACT_MUSCLE_MAPPINGS
  quadriceps: 'QUADRICEPS',
  shoulders: 'OMBRO',
  traps: 'TRAPEZIO',
  triceps: 'TRICEPS',
};

/**
 * Mapeamentos que NÃO são equivalência exata, e sim o grupo mais próximo. O
 * seed reporta esta lista para que a aproximação seja uma decisão visível, não
 * um detalhe enterrado no de-para.
 */
export const INEXACT_MUSCLE_MAPPINGS: ReadonlyArray<{
  sourceMuscle: string;
  muscleGroupCode: string;
  reason: string;
}> = [
  {
    sourceMuscle: 'neck',
    muscleGroupCode: 'TRAPEZIO',
    reason:
      'O catálogo do FITVO não tem grupo "pescoço". Aproximado para TRAPEZIO, ' +
      'o grupo efetivamente recrutado pelos exercícios de pescoço da fonte.',
  },
];

/** Grupo usado quando a fonte não oferece nenhum músculo utilizável. */
export const FALLBACK_MUSCLE_GROUP_CODE = 'CORPO_INTEIRO';

export function mapSourceMuscle(sourceMuscle: string): string | null {
  return MUSCLE_GROUP_CODE_BY_SOURCE_MUSCLE[sourceMuscle.trim().toLowerCase()] ?? null;
}

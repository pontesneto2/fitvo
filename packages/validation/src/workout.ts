import { z } from 'zod';

/**
 * Contrato do domínio de TREINO — Bloco 2: PRESCRIÇÃO (ADR-0009/D-032) — fonte
 * única. Cobre a montagem do plano pelo profissional:
 * `WorkoutPlan -> Workout -> WorkoutItem -> WorkoutSet`, mais clonagem (D-090).
 *
 * Nomes prefixados com `workout` (barrel flat). Fora deste contrato: execução
 * do aluno (`WorkoutSession`/`SetLog` — D-086), avaliação (D-087) e análise de
 * forma (D-088) são blocos próprios.
 */

const planOrganization = z
  .enum(['LETTER', 'WEEKDAY'])
  .describe('Organizacao do plano: A/B/C ou dias da semana (D-080).');

const planStatus = z
  .enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'ARCHIVED'])
  .describe('Estado operacional do plano (D-083/D-084/D-165).');

const weekday = z
  .enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
  .describe('Dia da semana (D-080).');

const setTechnique = z
  .enum(['NORMAL', 'DROP_SET'])
  .describe(
    'Tecnica da serie — catalogo MINIMO de proposito (D-081). Ampliar ' +
      '(rest-pause, piramide...) e decisao de produto + migracao, nao invencao.',
  );

// ---- Params -----------------------------------------------------------------
export const workoutTenantParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
});

export const workoutBondParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
  bondId: z.string().min(1).describe('ID do vinculo dono do plano (ADR-0001).'),
});

export const workoutPlanParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
  planId: z.string().min(1).describe('ID do plano de treino.'),
});

export const workoutWorkoutParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
  workoutId: z.string().min(1).describe('ID do treino do plano.'),
});

export const workoutItemParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
  itemId: z.string().min(1).describe('ID do item (exercicio) do treino.'),
});

// ---- WorkoutPlan ------------------------------------------------------------
// D-105: `fixedWeekdays` so tem sentido num plano FIXO. Num plano variavel a
// distribuicao pelos dias e do TREINO (`Workout.weekday` — D-080); aceitar os
// dois seria duas fontes de verdade para "quando este treino acontece".
const planFixedDaysRefinement = (body: {
  isFixed?: boolean | undefined;
  fixedWeekdays?: string[] | undefined;
}): boolean => Boolean(body.isFixed) || (body.fixedWeekdays ?? []).length === 0;

const PLAN_FIXED_DAYS_MESSAGE =
  'fixedWeekdays so vale em plano fixo (isFixed). Plano variavel distribui os ' +
  'dias no treino, nao no plano (D-080/D-105).';

export const workoutCreatePlanSchema = z
  .object({
    title: z.string().min(1),
    organization: planOrganization,
    // D-083: 30 dias e o DEFAULT, nao o unico valor — o profissional configura.
    // Teto de 365 evita "validade infinita" por digitacao, sem virar regra nova.
    validityDays: z.number().int().min(1).max(365).optional(),
    releaseAt: z.iso
      .datetime()
      .nullish()
      .describe('Liberacao programada em UTC (D-084); nulo = imediata.'),
    goal: z.string().min(1).nullish(),
    isFixed: z.boolean().optional().describe('Plano FIXO — roda por cima dos demais (D-105).'),
    fixedWeekdays: z
      .array(weekday)
      .optional()
      .describe('Dias em que o plano fixo vale; vazio = todo dia (D-105).'),
  })
  .refine(planFixedDaysRefinement, { message: PLAN_FIXED_DAYS_MESSAGE });

export const workoutUpdatePlanSchema = z
  .object({
    title: z.string().min(1).optional(),
    organization: planOrganization.optional(),
    validityDays: z.number().int().min(1).max(365).optional(),
    releaseAt: z.iso.datetime().nullish(),
    goal: z.string().min(1).nullish(),
    isFixed: z.boolean().optional(),
    fixedWeekdays: z.array(weekday).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para atualizar.',
  })
  .refine(planFixedDaysRefinement, { message: PLAN_FIXED_DAYS_MESSAGE });

/**
 * Clonagem (D-090): copia PROFUNDA plano -> treinos -> itens -> series para
 * OUTRO vinculo. `title` opcional renomeia a copia; o destino recebe registros
 * proprios (isolamento por vinculo — ADR-0001) e nasce em DRAFT.
 */
export const workoutClonePlanSchema = z.object({
  targetBondId: z.string().min(1).describe('Vinculo de DESTINO da copia.'),
  title: z.string().min(1).optional(),
});

// ---- Workout ----------------------------------------------------------------
// A coerencia `organization` <-> `label`/`weekday` (D-080) NAO cabe aqui: o Zod
// valida o corpo isolado e a organizacao vive no PLANO. O contrato garante o
// que da para garantir sem o pai (nao mandar os dois); o resto e invariante de
// dominio, validada no service contra o plano.
const workoutSlotRefinement = (body: {
  label?: string | null | undefined;
  weekday?: string | null | undefined;
}): boolean => !(body.label && body.weekday);

const WORKOUT_SLOT_MESSAGE =
  'Informe `label` (plano LETTER) ou `weekday` (plano WEEKDAY), nunca os dois (D-080).';

export const workoutCreateWorkoutSchema = z
  .object({
    title: z.string().min(1),
    label: z.string().min(1).max(4).nullish().describe('"A"/"B"/"C" quando o plano e LETTER.'),
    weekday: weekday.nullish().describe('Dia marcado quando o plano e WEEKDAY.'),
    position: z.number().int().min(0).optional(),
  })
  .refine(workoutSlotRefinement, { message: WORKOUT_SLOT_MESSAGE });

export const workoutUpdateWorkoutSchema = z
  .object({
    title: z.string().min(1).optional(),
    label: z.string().min(1).max(4).nullish(),
    weekday: weekday.nullish(),
    position: z.number().int().min(0).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para atualizar.',
  })
  .refine(workoutSlotRefinement, { message: WORKOUT_SLOT_MESSAGE });

// ---- WorkoutItem ------------------------------------------------------------
// Conjugados (D-082): `supersetGroup` agrupa, `supersetOrder` ordena DENTRO do
// grupo. Um sem o outro e grupo malformado — ou o item esta num grupo (e tem
// posicao nele) ou nao esta. Nao existe `roundCount`: a rodada e a serie de
// ordem N (D-082).
const supersetRefinement = (body: {
  supersetGroup?: number | null | undefined;
  supersetOrder?: number | null | undefined;
}): boolean => {
  const hasGroup = body.supersetGroup !== undefined && body.supersetGroup !== null;
  const hasOrder = body.supersetOrder !== undefined && body.supersetOrder !== null;
  return hasGroup === hasOrder;
};

const SUPERSET_MESSAGE =
  '`supersetGroup` e `supersetOrder` andam juntos: ou o item esta num conjugado ' +
  'e tem ordem nele, ou nao esta em nenhum (D-082).';

export const workoutCreateItemSchema = z
  .object({
    exerciseId: z
      .string()
      .min(1)
      .nullish()
      .describe('Exercicio da biblioteca (D-089); nulo = item livre.'),
    position: z.number().int().min(0).optional(),
    supersetGroup: z.number().int().min(0).nullish(),
    supersetOrder: z.number().int().min(0).nullish(),
    note: z.string().min(1).nullish(),
  })
  .refine(supersetRefinement, { message: SUPERSET_MESSAGE });

export const workoutUpdateItemSchema = z
  .object({
    exerciseId: z.string().min(1).nullish(),
    position: z.number().int().min(0).optional(),
    supersetGroup: z.number().int().min(0).nullish(),
    supersetOrder: z.number().int().min(0).nullish(),
    note: z.string().min(1).nullish(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para atualizar.',
  })
  .refine(supersetRefinement, { message: SUPERSET_MESSAGE });

// ---- WorkoutSet -------------------------------------------------------------
/**
 * SÉRIE-LINHA (D-081) — o coração do contrato. Cada entrada do array é UMA
 * série com seus próprios valores; a ordem no array É a `position` da série
 * (e, num conjugado, o índice da RODADA — D-082). Por isso NÃO existe campo
 * `position` no corpo: derivá-la do array torna "duas séries na mesma ordem"
 * irrepresentável, em vez de virar erro de banco.
 *
 * NÃO existe forma de dizer "3×12": um plano de 3 séries manda 3 entradas, e
 * elas podem divergir entre si — que é exatamente o requisito do D-081.
 *
 * CARGA EM COLUNAS TIPADAS (D-081): exatamente UMA grandeza por série —
 * peso (`weightGrams`), tempo (`durationSeconds`), distância (`distanceMeters`)
 * ou peso corporal (`bodyweight`). Nunca um par polimórfico `valor + unidade`:
 * uma agregação de evolução de carga (D-092) somaria gramas com segundos e o
 * bug seria silencioso. Tudo INTEIRO — gramas, segundos, metros, nunca float
 * (mesma disciplina do dinheiro em centavos — D-069).
 */
const workoutSetInputSchema = z
  .object({
    reps: z.number().int().positive().nullish().describe('Repeticoes prescritas.'),
    repsToFailure: z.boolean().optional().describe('"Ate a falha" — estado proprio (D-081).'),
    weightGrams: z
      .number()
      .int()
      .positive()
      .nullish()
      .describe('Carga em GRAMAS (22500 = 22,5kg).'),
    durationSeconds: z.number().int().positive().nullish().describe('Serie por tempo (prancha).'),
    distanceMeters: z
      .number()
      .int()
      .positive()
      .nullish()
      .describe('Serie por distancia (corrida).'),
    bodyweight: z.boolean().optional().describe('Peso corporal: sem carga externa.'),
    restSeconds: z
      .number()
      .int()
      .min(0)
      .nullish()
      .describe('Descanso apos a serie; num conjugado, zero ate o ultimo item (D-082).'),
    technique: setTechnique.optional(),
    note: z.string().min(1).nullish(),
  })
  .refine(
    (set) =>
      [set.weightGrams, set.durationSeconds, set.distanceMeters, set.bodyweight === true].filter(
        (value) => value !== undefined && value !== null && value !== false,
      ).length === 1,
    {
      message:
        'Informe exatamente UMA grandeza de carga: weightGrams, durationSeconds, ' +
        'distanceMeters ou bodyweight (D-081 — colunas tipadas, nunca polimorfico).',
    },
  )
  .refine((set) => !(set.repsToFailure === true && set.reps !== undefined && set.reps !== null), {
    message: '"Ate a falha" nao convive com um numero de repeticoes prescrito (D-081).',
  })
  .refine(
    (set) =>
      !(set.weightGrams ?? set.bodyweight === true) ||
      set.repsToFailure === true ||
      (set.reps !== undefined && set.reps !== null),
    {
      message: 'Serie de carga precisa de `reps` ou `repsToFailure` (D-081).',
    },
  );

export const workoutReplaceSetsSchema = z.object({
  sets: z
    .array(workoutSetInputSchema)
    .max(50)
    .describe(
      'Lista COMPLETA das series do item, na ordem de execucao. A posicao e o ' +
        'indice no array (D-081); num conjugado, e o indice da rodada (D-082). ' +
        'Lista vazia remove as series do item.',
    ),
});

// ---- Response ---------------------------------------------------------------
export const workoutSetViewSchema = z.object({
  id: z.string(),
  workoutItemId: z.string(),
  position: z.number().int(),
  reps: z.number().int().nullable(),
  repsToFailure: z.boolean(),
  weightGrams: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  distanceMeters: z.number().int().nullable(),
  bodyweight: z.boolean(),
  restSeconds: z.number().int().nullable(),
  technique: setTechnique,
  note: z.string().nullable(),
});

export const workoutItemViewSchema = z.object({
  id: z.string(),
  workoutId: z.string(),
  exerciseId: z.string().nullable(),
  position: z.number().int(),
  supersetGroup: z.number().int().nullable(),
  supersetOrder: z.number().int().nullable(),
  note: z.string().nullable(),
  sets: z.array(workoutSetViewSchema),
});

export const workoutViewSchema = z.object({
  id: z.string(),
  planId: z.string(),
  title: z.string(),
  label: z.string().nullable(),
  weekday: weekday.nullable(),
  position: z.number().int(),
  items: z.array(workoutItemViewSchema),
});

export const workoutPlanSummaryViewSchema = z.object({
  id: z.string(),
  bondId: z.string(),
  title: z.string(),
  organization: planOrganization,
  status: planStatus,
  validityDays: z.number().int(),
  validUntil: z.iso.datetime().nullable(),
  releaseAt: z.iso.datetime().nullable(),
  goal: z.string().nullable(),
  isFixed: z.boolean(),
  fixedWeekdays: z.array(weekday),
  /**
   * D-105 derivado, não armazenado: plano fixo roda POR CIMA e não é "o treino
   * de hoje" — contá-lo infla a aderência de quem não treinou (D-092). Exposto
   * no contrato para que o consumidor (indicadores, Bloco 3) não reimplemente
   * a regra e divirja.
   */
  countsTowardAdherence: z.boolean(),
  clonedFromWorkoutPlanId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const workoutPlanDetailViewSchema = workoutPlanSummaryViewSchema.extend({
  workouts: z.array(workoutViewSchema),
});

export const workoutPlanListResultSchema = z.object({
  plans: z.array(workoutPlanSummaryViewSchema),
});

export const workoutPlanListQuerySchema = z.object({
  status: planStatus.optional().describe('Filtra por estado operacional.'),
});

// ---- Tipos de wire ----------------------------------------------------------
export type WorkoutTenantParams = z.infer<typeof workoutTenantParamsSchema>;
export type WorkoutBondParams = z.infer<typeof workoutBondParamsSchema>;
export type WorkoutPlanParams = z.infer<typeof workoutPlanParamsSchema>;
export type WorkoutWorkoutParams = z.infer<typeof workoutWorkoutParamsSchema>;
export type WorkoutItemParams = z.infer<typeof workoutItemParamsSchema>;
export type WorkoutCreatePlanInput = z.infer<typeof workoutCreatePlanSchema>;
export type WorkoutUpdatePlanInput = z.infer<typeof workoutUpdatePlanSchema>;
export type WorkoutClonePlanInput = z.infer<typeof workoutClonePlanSchema>;
export type WorkoutCreateWorkoutInput = z.infer<typeof workoutCreateWorkoutSchema>;
export type WorkoutUpdateWorkoutInput = z.infer<typeof workoutUpdateWorkoutSchema>;
export type WorkoutCreateItemInput = z.infer<typeof workoutCreateItemSchema>;
export type WorkoutUpdateItemInput = z.infer<typeof workoutUpdateItemSchema>;
export type WorkoutSetInput = z.infer<typeof workoutSetInputSchema>;
export type WorkoutReplaceSetsInput = z.infer<typeof workoutReplaceSetsSchema>;
export type WorkoutSetView = z.infer<typeof workoutSetViewSchema>;
export type WorkoutItemView = z.infer<typeof workoutItemViewSchema>;
export type WorkoutView = z.infer<typeof workoutViewSchema>;
export type WorkoutPlanSummaryView = z.infer<typeof workoutPlanSummaryViewSchema>;
export type WorkoutPlanDetailView = z.infer<typeof workoutPlanDetailViewSchema>;
export type WorkoutPlanListQuery = z.infer<typeof workoutPlanListQuerySchema>;

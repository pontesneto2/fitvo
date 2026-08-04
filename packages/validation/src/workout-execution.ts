import { z } from 'zod';

/**
 * Contrato do domínio de TREINO — Bloco 3: EXECUÇÃO (ADR-0009/D-032) — fonte
 * única. Cobre o lado do ALUNO: `WorkoutSession` (D-086), `SetLog` (D-086),
 * `WorkoutRating` (D-087) e os indicadores derivados de aderência (D-092).
 *
 * A FRICÇÃO É A DECISÃO DE PRODUTO deste bloco, e o contrato a expressa:
 *
 * - CHECK-IN É LEVE. Concluir o treino exige duas coisas: dizer que fez
 *   (`POST .../complete`) e avaliar (`rating`, obrigatório — D-086/D-087).
 *   Nada mais.
 * - REGISTRO DE CARGA REAL É INCENTIVADO, NÃO OBRIGATÓRIO. `SetLog` tem rota
 *   PRÓPRIA justamente por isso: não é campo do corpo da conclusão, e por
 *   construção não há como a conclusão passar a depender dele. Exigir série a
 *   série mataria a adesão — e o check-in (presença) é o sinal que alimenta os
 *   indicadores (D-092) e as réguas de ausência.
 *
 * Nomes prefixados com `workout` (barrel flat), como o Bloco 2. Fora deste
 * contrato: prescrição (`./workout`), análise de forma por IA (D-088),
 * progressão sugerida (D-167) e o card visual compartilhável — blocos próprios.
 */

const workoutSessionStatus = z
  .enum(['IN_PROGRESS', 'COMPLETED'])
  .describe(
    'Estado da sessao (D-086). IN_PROGRESS existe porque a execucao nasce no ' +
      'device (D-099); COMPLETED e o CHECK-IN que alimenta os indicadores (D-092).',
  );

const workoutReaction = z
  .enum(['DIED', 'FLEW', 'WOBBLY_LEGS'])
  .describe(
    'Reacao rapida da avaliacao (D-087): o enum guarda o CODIGO; label e emoji ' +
      '("morri 💀") vivem no i18n (D-066), nunca no contrato.',
  );

// ---- Params -----------------------------------------------------------------
// O ALUNO não tem `:tenantId` no path (mesmo padrão de `/me/plans` e
// `/v1/consents`): o paciente é a PESSOA, e o vínculo é que diz em que tenant
// aquela execução vive. O tenant do path serviria só de palpite do cliente.

export const workoutExecutionWorkoutParamsSchema = z.object({
  workoutId: z.string().min(1).describe('Treino prescrito que o aluno vai executar.'),
});

export const workoutSessionParamsSchema = z.object({
  sessionId: z.string().min(1).describe('ID da sessao de execucao.'),
});

// ---- Abertura da sessão -----------------------------------------------------
export const workoutStartSessionSchema = z.object({
  /**
   * D-099 — a execução nasce no device, com ou sem sinal. `performedAt` é do
   * ALUNO (quando treinou), não do servidor: uma sessão registrada na academia
   * às 6h e sincronizada às 9h aconteceu às 6h, e é esse instante que os
   * indicadores por data (D-092) precisam enxergar. Ausente = agora.
   */
  performedAt: z.iso
    .datetime()
    .optional()
    .describe('Quando o treino foi executado, em UTC (D-067/D-099). Ausente = agora.'),
});

// ---- SetLog (INCENTIVADO, nunca obrigatório) --------------------------------
/**
 * D-086 — a CARGA REAL usada, que pode divergir da prescrita. Espelha as
 * grandezas tipadas do `WorkoutSet` (D-081) pelo mesmo motivo: com um par
 * polimórfico `valor + unidade`, a "evolução de carga por exercício" (D-092)
 * somaria gramas com segundos e o bug seria SILENCIOSO.
 *
 * NO MÁXIMO uma grandeza — não exatamente uma, ao contrário da prescrição. O
 * aluno pode simplesmente marcar a série como feita sem digitar carga; forçá-lo
 * a informar um número para registrar presença é exatamente a fricção que este
 * bloco decidiu não ter.
 *
 * `workoutSetId` é opcional: o aluno pode ter feito uma série que ninguém
 * prescreveu. O log existe do mesmo jeito — o dado real é o que importa (D-085).
 */
export const workoutLogSetSchema = z
  .object({
    workoutSetId: z
      .string()
      .min(1)
      .nullish()
      .describe('Serie prescrita de referencia; nulo = serie livre do aluno (D-086).'),
    done: z.boolean().optional().describe('A serie foi executada. Ausente = true.'),
    actualReps: z.number().int().positive().nullish().describe('Repeticoes realmente feitas.'),
    actualWeightGrams: z
      .number()
      .int()
      .positive()
      .nullish()
      .describe('Carga REAL em GRAMAS (22500 = 22,5kg) — inteiro, nunca float (D-081).'),
    actualDurationSeconds: z
      .number()
      .int()
      .positive()
      .nullish()
      .describe('Tempo REAL em segundos.'),
    actualDistanceMeters: z
      .number()
      .int()
      .positive()
      .nullish()
      .describe('Distancia REAL em metros.'),
    note: z.string().min(1).nullish(),
  })
  .refine(
    (log) =>
      [log.actualWeightGrams, log.actualDurationSeconds, log.actualDistanceMeters].filter(
        (value) => value !== undefined && value !== null,
      ).length <= 1,
    {
      message:
        'Informe no maximo UMA grandeza de carga real: actualWeightGrams, ' +
        'actualDurationSeconds ou actualDistanceMeters (D-081 — colunas tipadas, ' +
        'nunca polimorfico).',
    },
  );

// ---- Avaliação (OBRIGATÓRIA na conclusão) -----------------------------------
/**
 * D-087 — nota, esforço percebido, comentário livre e reações rápidas. As
 * reações são o que torna a tela printável (aquisição orgânica), e viajam como
 * CÓDIGO: trocar "morri 💀" é tradução, não migração (D-066).
 *
 * ESCALA DO ESFORÇO: o ADR fixa "nível de esforço percebido" sem cravar a
 * escala. Adotamos 1–10 (RPE/Borg CR10, a convenção do treinamento de força) —
 * é limite de validação, não regra de negócio nova: sem faixa, o contrato
 * aceitaria 9999 e o indicador do D-092 ficaria sem sentido comparável.
 */
export const workoutRatingInputSchema = z.object({
  score: z.number().int().min(1).max(5).describe('Nota do treino, 1 a 5 (D-087).'),
  perceivedEffort: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe('Esforco percebido, 1 a 10 (RPE — D-087).'),
  comment: z.string().min(1).max(2000).nullish().describe('Comentario livre (D-087).'),
  reactions: z
    .array(workoutReaction)
    .max(3)
    .optional()
    .describe('Reacoes rapidas por CODIGO; label/emoji no i18n (D-066/D-087).'),
});

/**
 * D-086 — CONCLUIR = CHECK-IN. O corpo carrega a avaliação (obrigatória,
 * D-087) e MAIS NADA. Não há campo de série aqui de propósito: a conclusão não
 * pode passar a depender do registro de carga sem alguém mudar o contrato,
 * e é essa a garantia estrutural de que o check-in continua leve.
 */
export const workoutCompleteSessionSchema = z.object({
  rating: workoutRatingInputSchema.describe('Avaliacao do treino — OBRIGATORIA (D-086/D-087).'),
});

// ---- Response ---------------------------------------------------------------
export const workoutSetLogViewSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  workoutSetId: z.string().nullable(),
  done: z.boolean(),
  actualReps: z.number().int().nullable(),
  actualWeightGrams: z.number().int().nullable(),
  actualDurationSeconds: z.number().int().nullable(),
  actualDistanceMeters: z.number().int().nullable(),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const workoutRatingViewSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  score: z.number().int(),
  perceivedEffort: z.number().int(),
  comment: z.string().nullable(),
  reactions: z.array(workoutReaction),
  createdAt: z.iso.datetime(),
});

export const workoutSessionSummaryViewSchema = z.object({
  id: z.string(),
  bondId: z.string(),
  workoutId: z.string(),
  planId: z.string(),
  status: workoutSessionStatus,
  performedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const workoutSessionDetailViewSchema = workoutSessionSummaryViewSchema.extend({
  setLogs: z.array(workoutSetLogViewSchema),
  rating: workoutRatingViewSchema.nullable(),
});

export const workoutSessionListResultSchema = z.object({
  sessions: z.array(workoutSessionSummaryViewSchema),
});

export const workoutSessionListQuerySchema = z.object({
  status: workoutSessionStatus.optional(),
  from: z.iso.datetime().optional().describe('Inicio da janela por `performedAt` (UTC).'),
  to: z.iso.datetime().optional().describe('Fim da janela por `performedAt` (UTC).'),
});

/**
 * D-092 — a janela é OBRIGATÓRIA: "aderência" sem período não é uma pergunta
 * respondível, e uma consulta sem recorte varreria o histórico inteiro, que o
 * D-100 garante que nunca é apagado.
 */
export const workoutAdherenceQuerySchema = z
  .object({
    from: z.iso.datetime().describe('Inicio do periodo, em UTC (D-067).'),
    to: z.iso.datetime().describe('Fim do periodo, em UTC (D-067).'),
  })
  .refine((query) => new Date(query.from).getTime() <= new Date(query.to).getTime(), {
    message: '`from` precisa ser anterior ou igual a `to`.',
  });

/**
 * D-092 — indicadores DERIVADOS dos check-ins, sem entidade de agregação
 * própria: cada número aqui é um `count` sobre `WorkoutSession` no período.
 *
 * D-105 vive no `adherenceSessions`: sessões de plano FIXO (alongamento/
 * mobilidade, que roda POR CIMA dos demais) contam em `completedSessions` — o
 * aluno fez o trabalho e ele não some — mas NÃO em `adherenceSessions`, senão o
 * alongamento infla a aderência de quem não treinou.
 *
 * NÃO HÁ PERCENTUAL. "% de treinos concluídos" (D-092) precisa de um
 * denominador — quantos treinos eram esperados no período — e nenhum ADR
 * decidiu como contá-lo (plano por letra é executado "na ordem que o aluno
 * quiser", D-080: não há dia esperado). Devolver um % com denominador inventado
 * seria pior que não devolver: a UI o exibiria como verdade. O numerador nasce
 * aqui; o denominador é mesa própria.
 */
export const workoutAdherencePlanBreakdownSchema = z.object({
  planId: z.string(),
  isFixed: z.boolean(),
  countsTowardAdherence: z.boolean().describe('Derivado do D-105 no servidor, nunca no cliente.'),
  completedSessions: z.number().int(),
});

export const workoutAdherenceViewSchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  completedSessions: z.number().int().describe('Todos os check-ins do periodo (D-086).'),
  adherenceSessions: z
    .number()
    .int()
    .describe('Check-ins que CONTAM na aderencia — exclui plano fixo (D-105).'),
  daysTrained: z
    .number()
    .int()
    .describe('Dias distintos (UTC) com check-in que conta na aderencia (D-092).'),
  byPlan: z.array(workoutAdherencePlanBreakdownSchema),
});

// ---- Tipos de wire ----------------------------------------------------------
export type WorkoutExecutionWorkoutParams = z.infer<typeof workoutExecutionWorkoutParamsSchema>;
export type WorkoutSessionParams = z.infer<typeof workoutSessionParamsSchema>;
export type WorkoutStartSessionInput = z.infer<typeof workoutStartSessionSchema>;
export type WorkoutLogSetInput = z.infer<typeof workoutLogSetSchema>;
export type WorkoutRatingInput = z.infer<typeof workoutRatingInputSchema>;
export type WorkoutCompleteSessionInput = z.infer<typeof workoutCompleteSessionSchema>;
export type WorkoutSetLogView = z.infer<typeof workoutSetLogViewSchema>;
export type WorkoutRatingView = z.infer<typeof workoutRatingViewSchema>;
export type WorkoutSessionSummaryView = z.infer<typeof workoutSessionSummaryViewSchema>;
export type WorkoutSessionDetailView = z.infer<typeof workoutSessionDetailViewSchema>;
export type WorkoutSessionListQuery = z.infer<typeof workoutSessionListQuerySchema>;
export type WorkoutAdherenceQuery = z.infer<typeof workoutAdherenceQuerySchema>;
export type WorkoutAdherenceView = z.infer<typeof workoutAdherenceViewSchema>;

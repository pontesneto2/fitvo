import {
  problemDetailsSchema,
  workoutBondParamsSchema,
  workoutClonePlanSchema,
  workoutCreateItemSchema,
  workoutCreatePlanSchema,
  workoutCreateWorkoutSchema,
  workoutItemParamsSchema,
  workoutItemViewSchema,
  workoutPlanDetailViewSchema,
  workoutPlanListQuerySchema,
  workoutPlanListResultSchema,
  workoutPlanParamsSchema,
  workoutPlanSummaryViewSchema,
  workoutReplaceSetsSchema,
  workoutUpdateItemSchema,
  workoutUpdatePlanSchema,
  workoutUpdateWorkoutSchema,
  workoutViewSchema,
  workoutWorkoutParamsSchema,
} from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { WorkoutApplicationService } from './workout-application-service';

const TAGS = ['workout'];
const bearerAuth = [{ bearerAuth: [] }];

const emptySchema = z.object({});

/**
 * Vertical slice da PRESCRIÇÃO de treino — Bloco 2 (ADR-0009). Versão na URL
 * /v1 (D-034). O profissional monta `WorkoutPlan -> Workout -> WorkoutItem ->
 * WorkoutSet` para um VÍNCULO e pode clonar para outro (D-090).
 *
 * Todas as rotas do profissional exigem perfil profissional no tenant do path E
 * que o vínculo/recurso pertença a ele (D-002/ADR-0001) — o `:tenantId` é
 * controlado pelo cliente e nunca vale como prova de pertencimento.
 *
 * `GET /me/plans` é a ÚNICA rota do aluno aqui, e é só-leitura: nunca devolve
 * DRAFT (D-165). A execução (D-086) é bloco próprio.
 *
 * D-032: schemas Zod de `@fitvo/validation` são a fonte única.
 */
export function workoutRoutes(service: WorkoutApplicationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    // ---- Plano --------------------------------------------------------------

    app.post(
      '/:tenantId/bonds/:bondId/plans',
      {
        schema: {
          tags: TAGS,
          summary: 'Cria um plano de treino para o vinculo (profissional)',
          description:
            'Nasce em DRAFT — invisivel ao aluno ate ser liberado (D-165). A ' +
            'organizacao (LETTER A/B/C ou WEEKDAY) e do PLANO (D-080) e define qual ' +
            'campo do treino vale. `validUntil` e SEMPRE derivado de `validityDays` ' +
            '(30d padrao, configuravel — D-083), nunca aceito do cliente. N planos ' +
            'ativos por vinculo sao permitidos (D-079). `isFixed` marca o plano que ' +
            'roda POR CIMA dos demais e nao conta na aderencia (D-105).',
          security: bearerAuth,
          params: workoutBondParamsSchema,
          body: workoutCreatePlanSchema,
          response: {
            201: workoutPlanSummaryViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const plan = await service.createPlan(
          request.headers.authorization,
          request.params.tenantId,
          request.params.bondId,
          request.body,
        );
        return reply.code(201).send(plan);
      },
    );

    app.get(
      '/:tenantId/bonds/:bondId/plans',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista os planos de treino do vinculo (profissional)',
          description:
            'D-079: o vinculo pode ter N planos ATIVOS simultaneos ("Musculacao ' +
            'Julho" + "Cardio Julho") — a lista nao presume plano unico.',
          security: bearerAuth,
          params: workoutBondParamsSchema,
          querystring: workoutPlanListQuerySchema,
          response: {
            200: workoutPlanListResultSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const plans = await service.listPlans(
          request.headers.authorization,
          request.params.tenantId,
          request.params.bondId,
          request.query,
        );
        return reply.send({ plans });
      },
    );

    app.get(
      '/:tenantId/plans/:planId',
      {
        schema: {
          tags: TAGS,
          summary: 'Detalha o plano com a arvore completa (profissional)',
          description: 'Plano -> treinos -> itens -> series, cada serie uma linha (D-081).',
          security: bearerAuth,
          params: workoutPlanParamsSchema,
          response: {
            200: workoutPlanDetailViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const plan = await service.getPlan(
          request.headers.authorization,
          request.params.tenantId,
          request.params.planId,
        );
        return reply.send(plan);
      },
    );

    app.patch(
      '/:tenantId/plans/:planId',
      {
        schema: {
          tags: TAGS,
          summary: 'Atualiza o plano (profissional)',
          description:
            'Mexer em `validityDays` ou `releaseAt` RECALCULA `validUntil` (D-083): ' +
            'as duas sao as entradas da formula, e um vencimento velho ao lado de uma ' +
            'validade nova seria estado divergente. Plano ARCHIVED nao aceita ' +
            'alteracao — historico preservado (D-053).',
          security: bearerAuth,
          params: workoutPlanParamsSchema,
          body: workoutUpdatePlanSchema,
          response: {
            200: workoutPlanSummaryViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            409: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const plan = await service.updatePlan(
          request.headers.authorization,
          request.params.tenantId,
          request.params.planId,
          request.body,
        );
        return reply.send(plan);
      },
    );

    app.post(
      '/:tenantId/plans/:planId/release',
      {
        schema: {
          tags: TAGS,
          summary: 'Libera o plano ao aluno (DRAFT -> SCHEDULED/ACTIVE)',
          description:
            'DRAFT -> SCHEDULED quando ha `releaseAt` futuro (D-084), senao ACTIVE. ' +
            'E o ponto em que o plano deixa de ser invisivel ao aluno (D-165), entao ' +
            'e aqui que conjugado incompleto e barrado (D-082) e que a validade passa ' +
            'a contar (D-083). NAO mexe no eixo ISSUED/CANCELLED do fluxo do ' +
            'estagiario — slice futuro.',
          security: bearerAuth,
          params: workoutPlanParamsSchema,
          body: emptySchema,
          response: {
            200: workoutPlanSummaryViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            409: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const plan = await service.releasePlan(
          request.headers.authorization,
          request.params.tenantId,
          request.params.planId,
        );
        return reply.send(plan);
      },
    );

    app.post(
      '/:tenantId/plans/:planId/archive',
      {
        schema: {
          tags: TAGS,
          summary: 'Arquiva o plano (delecao LOGICA)',
          description: 'D-053/D-089: encerra sem apagar — o historico do aluno permanece integro.',
          security: bearerAuth,
          params: workoutPlanParamsSchema,
          body: emptySchema,
          response: {
            200: workoutPlanSummaryViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const plan = await service.archivePlan(
          request.headers.authorization,
          request.params.tenantId,
          request.params.planId,
        );
        return reply.send(plan);
      },
    );

    app.post(
      '/:tenantId/plans/:planId/clone',
      {
        schema: {
          tags: TAGS,
          summary: 'Clona o plano para OUTRO vinculo (copia profunda)',
          description:
            'D-090: copia plano -> treinos -> itens -> series em registros PROPRIOS do ' +
            'vinculo de destino (isolamento por vinculo — ADR-0001), numa transacao. ' +
            'Registra a linhagem em `clonedFromWorkoutPlanId` (ponteiro de auditoria, ' +
            'nao rota de leitura) e NAO vincula execucao: a sessao de um aluno nunca ' +
            'vira a de outro. A copia nasce em DRAFT, com validade PROPRIA contada de ' +
            'agora. Origem e destino sao verificados contra o MESMO profissional.',
          security: bearerAuth,
          params: workoutPlanParamsSchema,
          body: workoutClonePlanSchema,
          response: {
            201: workoutPlanSummaryViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const plan = await service.clonePlan(
          request.headers.authorization,
          request.params.tenantId,
          request.params.planId,
          request.body,
        );
        return reply.code(201).send(plan);
      },
    );

    // ---- Treino -------------------------------------------------------------

    app.post(
      '/:tenantId/plans/:planId/workouts',
      {
        schema: {
          tags: TAGS,
          summary: 'Cria um treino no plano (profissional)',
          description:
            'D-080: plano LETTER exige `label` (A/B/C) e recusa `weekday`; plano ' +
            'WEEKDAY exige `weekday` e recusa `label`. A coerencia e invariante de ' +
            'DOMINIO — as duas colunas existem e so o plano diz qual vale.',
          security: bearerAuth,
          params: workoutPlanParamsSchema,
          body: workoutCreateWorkoutSchema,
          response: {
            201: workoutViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            409: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const workout = await service.createWorkout(
          request.headers.authorization,
          request.params.tenantId,
          request.params.planId,
          request.body,
        );
        return reply.code(201).send(workout);
      },
    );

    app.patch(
      '/:tenantId/workouts/:workoutId',
      {
        schema: {
          tags: TAGS,
          summary: 'Atualiza um treino (profissional)',
          security: bearerAuth,
          params: workoutWorkoutParamsSchema,
          body: workoutUpdateWorkoutSchema,
          response: {
            200: workoutViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            409: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const workout = await service.updateWorkout(
          request.headers.authorization,
          request.params.tenantId,
          request.params.workoutId,
          request.body,
        );
        return reply.send(workout);
      },
    );

    app.delete(
      '/:tenantId/workouts/:workoutId',
      {
        schema: {
          tags: TAGS,
          summary: 'Remove um treino do plano (delecao LOGICA)',
          description: 'D-089: tombstone `deletedAt`, nunca DELETE fisico.',
          security: bearerAuth,
          params: workoutWorkoutParamsSchema,
          response: {
            // 204 sem corpo: o Fastify nao serializa payload nesse status — o
            // `z.null()` existe so para o type provider reconhecer o codigo.
            204: z.null(),
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        await service.deleteWorkout(
          request.headers.authorization,
          request.params.tenantId,
          request.params.workoutId,
        );
        return reply.code(204).send(null);
      },
    );

    // ---- Item (exercício do treino) -----------------------------------------

    app.post(
      '/:tenantId/workouts/:workoutId/items',
      {
        schema: {
          tags: TAGS,
          summary: 'Adiciona um exercicio ao treino (profissional)',
          description:
            'CONJUGADOS (D-082): itens com o mesmo `supersetGroup` sao executados em ' +
            'sequencia sem descanso (bi-set/tri-set/circuito); `supersetOrder` e a ' +
            'ordem DENTRO do grupo. NAO existe `roundCount` nem entidade de bloco — a ' +
            'rodada N e a SERIE de ordem N de cada item.',
          security: bearerAuth,
          params: workoutWorkoutParamsSchema,
          body: workoutCreateItemSchema,
          response: {
            201: workoutItemViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            409: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const item = await service.createItem(
          request.headers.authorization,
          request.params.tenantId,
          request.params.workoutId,
          request.body,
        );
        return reply.code(201).send(item);
      },
    );

    app.patch(
      '/:tenantId/items/:itemId',
      {
        schema: {
          tags: TAGS,
          summary: 'Atualiza um item do treino (profissional)',
          description:
            'Mover o item para outro `supersetGroup` revalida a invariante do D-082 ' +
            'sobre o estado que RESULTARIA da mudanca: itens do mesmo grupo tem a ' +
            'mesma contagem de series.',
          security: bearerAuth,
          params: workoutItemParamsSchema,
          body: workoutUpdateItemSchema,
          response: {
            200: workoutItemViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const item = await service.updateItem(
          request.headers.authorization,
          request.params.tenantId,
          request.params.itemId,
          request.body,
        );
        return reply.send(item);
      },
    );

    app.delete(
      '/:tenantId/items/:itemId',
      {
        schema: {
          tags: TAGS,
          summary: 'Remove um item do treino (delecao LOGICA)',
          security: bearerAuth,
          params: workoutItemParamsSchema,
          response: {
            // 204 sem corpo: o Fastify nao serializa payload nesse status — o
            // `z.null()` existe so para o type provider reconhecer o codigo.
            204: z.null(),
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        await service.deleteItem(
          request.headers.authorization,
          request.params.tenantId,
          request.params.itemId,
        );
        return reply.code(204).send(null);
      },
    );

    // ---- Séries -------------------------------------------------------------

    app.put(
      '/:tenantId/items/:itemId/sets',
      {
        schema: {
          tags: TAGS,
          summary: 'Prescreve as series do item (SERIE-LINHA — substitui a lista)',
          description:
            'D-081: CADA SERIE E UMA LINHA PROPRIA e pode divergir das demais (serie 1 ' +
            '12 reps a 20kg; serie 3 ate a falha a 25kg em drop-set). NAO existe forma ' +
            'de dizer "3x12": mandam-se 3 entradas. A posicao e o INDICE no array — ' +
            'num conjugado, o indice da RODADA (D-082). Carga em colunas TIPADAS: ' +
            'exatamente uma grandeza por serie (peso/tempo/distancia/peso corporal), ' +
            'tudo inteiro (gramas/segundos/metros), nunca par polimorfico. Substituicao ' +
            'em bloco e TRANSACIONAL: ou entra a lista inteira, ou nada muda.',
          security: bearerAuth,
          params: workoutItemParamsSchema,
          body: workoutReplaceSetsSchema,
          response: {
            200: workoutItemViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const item = await service.replaceSets(
          request.headers.authorization,
          request.params.tenantId,
          request.params.itemId,
          request.body,
        );
        return reply.send(item);
      },
    );

    // ---- Superfície do ALUNO ------------------------------------------------

    app.get(
      '/me/plans',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista os planos de treino do ALUNO autenticado',
          description:
            'So-leitura. NUNCA devolve DRAFT (D-165): plano em montagem nao existe ' +
            'para quem vai executar. Sem `:tenantId` no path de proposito — o paciente ' +
            'e a PESSOA, e o vinculo diz em que tenant cada plano dele vive (mesmo ' +
            'padrao de /v1/consents).',
          security: bearerAuth,
          response: {
            200: workoutPlanListResultSchema,
            401: problemDetailsSchema,
            403: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const plans = await service.listMyPlans(request.headers.authorization);
        return reply.send({ plans });
      },
    );
  };
}

import {
  exerciseLibraryCreateExerciseSchema,
  exerciseLibraryCreateResultSchema,
  exerciseLibraryExerciseParamsSchema,
  exerciseLibraryExerciseViewSchema,
  exerciseLibraryListQuerySchema,
  exerciseLibraryListResultSchema,
  exerciseLibraryMuscleGroupListResultSchema,
  exerciseLibraryTenantParamsSchema,
  exerciseLibraryUpdateExerciseSchema,
  problemDetailsSchema,
} from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { ExerciseLibraryApplicationService } from './exercise-library-application-service';

const TAGS = ['exercise-library'];
const bearerAuth = [{ bearerAuth: [] }];

/**
 * Vertical slice da BIBLIOTECA DE EXERCICIOS (D-089/D-091/D-164, D-168 a D-171
 * — ADR-0009). Versao na URL /v1 (D-034). Toda rota exige perfil profissional
 * no tenant do path.
 *
 * O que a biblioteca guarda e o que o exercicio E (nome, descricao, musculo,
 * video). O que foi PRESCRITO (carga, serie, tecnica) e do TREINO
 * (WorkoutItem/WorkoutSet — D-089) e nao mora aqui.
 *
 * D-032: schemas Zod de `@fitvo/validation` sao a fonte unica.
 */
export function exerciseLibraryRoutes(
  service: ExerciseLibraryApplicationService,
): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/:tenantId/muscle-groups',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista o catalogo de grupos musculares (profissional)',
          description:
            'Catalogo GLOBAL, em tabela e nao enum (D-164) — igual para todo tenant. ' +
            'Devolve apenas os ACTIVE: grupo descontinuado some da busca mas segue ' +
            'valido nos exercicios que ja o referenciam (D-089).',
          security: bearerAuth,
          params: exerciseLibraryTenantParamsSchema,
          response: {
            200: exerciseLibraryMuscleGroupListResultSchema,
            403: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const muscleGroups = await service.listMuscleGroups(
          request.headers.authorization,
          request.params.tenantId,
        );
        return reply.send({ muscleGroups });
      },
    );

    app.get(
      '/:tenantId/exercises',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista a biblioteca visivel ao profissional',
          description:
            'Devolve a base PLATFORM (compartilhada) MAIS os itens PRIVATE do proprio ' +
            'profissional (D-171): o item privado de um colega da mesma clinica NAO ' +
            'aparece. A busca compara sobre o nome NORMALIZADO (D-169), entao "Supino" ' +
            'acha "supino reto". Por padrao devolve so ACTIVE (D-089).',
          security: bearerAuth,
          params: exerciseLibraryTenantParamsSchema,
          querystring: exerciseLibraryListQuerySchema,
          response: { 200: exerciseLibraryListResultSchema, 403: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        const exercises = await service.listExercises(
          request.headers.authorization,
          request.params.tenantId,
          request.query,
        );
        return reply.send({ exercises });
      },
    );

    app.get(
      '/:tenantId/exercises/:exerciseId',
      {
        schema: {
          tags: TAGS,
          summary: 'Detalha um exercicio da biblioteca visivel ao profissional',
          security: bearerAuth,
          params: exerciseLibraryExerciseParamsSchema,
          response: {
            200: exerciseLibraryExerciseViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const exercise = await service.getExercise(
          request.headers.authorization,
          request.params.tenantId,
          request.params.exerciseId,
        );
        return reply.send(exercise);
      },
    );

    app.post(
      '/:tenantId/exercises',
      {
        schema: {
          tags: TAGS,
          summary: 'Cria um exercicio na biblioteca do profissional',
          description:
            'Nasce SEMPRE PRIVATE (D-170 — default seguro; o sistema nunca auto-promove ' +
            'para a base comum). ANTI-DUPLICACAO (D-169): se ja existir equivalente por ' +
            'nome NORMALIZADO na biblioteca visivel, nada e criado e o item existente e ' +
            'devolvido com outcome DUPLICATE_FOUND e HTTP 200 (201 quando cria de fato).',
          security: bearerAuth,
          params: exerciseLibraryTenantParamsSchema,
          body: exerciseLibraryCreateExerciseSchema,
          response: {
            200: exerciseLibraryCreateResultSchema,
            201: exerciseLibraryCreateResultSchema,
            403: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const result = await service.createExercise(
          request.headers.authorization,
          request.params.tenantId,
          request.body,
        );
        return reply.code(result.outcome === 'CREATED' ? 201 : 200).send(result);
      },
    );

    app.patch(
      '/:tenantId/exercises/:exerciseId',
      {
        schema: {
          tags: TAGS,
          summary: 'Atualiza um exercicio proprio do profissional',
          description:
            'So o AUTOR altera (D-171): item PLATFORM e visivel a todos mas nao editavel ' +
            'por fora de um fluxo de curadoria. Editar a biblioteca propaga para todo o ' +
            'app e NUNCA reescreve a prescricao ja feita (D-089).',
          security: bearerAuth,
          params: exerciseLibraryExerciseParamsSchema,
          body: exerciseLibraryUpdateExerciseSchema,
          response: {
            200: exerciseLibraryExerciseViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            409: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const exercise = await service.updateExercise(
          request.headers.authorization,
          request.params.tenantId,
          request.params.exerciseId,
          request.body,
        );
        return reply.send(exercise);
      },
    );

    app.post(
      '/:tenantId/exercises/:exerciseId/discontinue',
      {
        schema: {
          tags: TAGS,
          summary: 'Descontinua um exercicio proprio (delecao LOGICA)',
          description:
            'D-089: nunca ha DELETE fisico. O item sai da busca mas CONTINUA funcionando ' +
            'nos treinos que ja o usam — o historico permanece integro.',
          security: bearerAuth,
          params: exerciseLibraryExerciseParamsSchema,
          response: {
            200: exerciseLibraryExerciseViewSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const exercise = await service.discontinueExercise(
          request.headers.authorization,
          request.params.tenantId,
          request.params.exerciseId,
        );
        return reply.send(exercise);
      },
    );
  };
}

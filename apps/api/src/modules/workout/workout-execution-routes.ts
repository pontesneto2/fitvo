import {
  problemDetailsSchema,
  workoutAdherenceQuerySchema,
  workoutAdherenceViewSchema,
  workoutBondParamsSchema,
  workoutCompleteSessionSchema,
  workoutExecutionWorkoutParamsSchema,
  workoutLogSetSchema,
  workoutSessionDetailViewSchema,
  workoutSessionListQuerySchema,
  workoutSessionListResultSchema,
  workoutSessionParamsSchema,
  workoutSessionSummaryViewSchema,
  workoutSetLogViewSchema,
  workoutStartSessionSchema,
  workoutTenantParamsSchema,
} from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { WorkoutExecutionApplicationService } from './workout-execution-application-service';

const TAGS = ['workout-execution'];
const bearerAuth = [{ bearerAuth: [] }];

/** Sessão vista pelo profissional: `:tenantId` no path + id da sessão. */
const professionalSessionParamsSchema = workoutTenantParamsSchema.extend(
  workoutSessionParamsSchema.shape,
);

/**
 * Vertical slice da EXECUÇÃO de treino — Bloco 3 (ADR-0009). Versão na URL /v1
 * (D-034). É onde o ciclo fecha: o aluno abre a sessão do treino prescrito
 * (Bloco 2), opcionalmente registra a carga real e faz o CHECK-IN avaliando.
 *
 * DUAS SUPERFÍCIES, e a assimetria é a regra:
 *
 * - `/me/...` — o ALUNO. Sem `:tenantId` no path (mesmo padrão de `/me/plans` e
 *   `/v1/consents`): o paciente é a PESSOA, e o vínculo é que diz em que tenant
 *   cada execução vive. É a única superfície que ESCREVE.
 * - `/:tenantId/bonds/:bondId/...` — o PROFISSIONAL, só LEITURA. Ele acompanha;
 *   quem treina é o aluno, e presença registrada por terceiro não é presença.
 *
 * A FRICÇÃO ESTÁ NO DESENHO DAS ROTAS: o registro de carga (`set-logs`) é rota
 * PRÓPRIA e opcional, enquanto `complete` carrega só a avaliação. Não existe
 * corpo de conclusão que aceite séries — logo, não existe caminho em que
 * concluir passe a depender de registrar.
 *
 * D-032: schemas Zod de `@fitvo/validation` são a fonte única.
 */
export function workoutExecutionRoutes(
  service: WorkoutExecutionApplicationService,
): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    // ---- Aluno: execução ----------------------------------------------------

    app.post(
      '/me/workouts/:workoutId/sessions',
      {
        schema: {
          tags: TAGS,
          summary: 'Abre a sessao de execucao de um treino (aluno)',
          description:
            'D-086: a sessao nasce IN_PROGRESS — a execucao comeca no device e pode ' +
            'ficar pendente ate sincronizar (D-099). `performedAt` e do ALUNO (quando ' +
            'treinou), nao do servidor: quem treinou as 6h e sincronizou as 9h treinou ' +
            'as 6h, e e esse instante que os indicadores por data enxergam (D-092). ' +
            'O aluno nunca executa plano em DRAFT (D-165).',
          security: bearerAuth,
          params: workoutExecutionWorkoutParamsSchema,
          body: workoutStartSessionSchema,
          response: {
            201: workoutSessionSummaryViewSchema,
            401: problemDetailsSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const session = await service.startSession(
          request.headers.authorization,
          request.params.workoutId,
          request.body,
        );
        return reply.code(201).send(session);
      },
    );

    app.post(
      '/me/sessions/:sessionId/set-logs',
      {
        schema: {
          tags: TAGS,
          summary: 'Registra a carga REAL de uma serie executada (aluno) — OPCIONAL',
          description:
            'D-086: INCENTIVADO, NUNCA OBRIGATORIO. E o dado premium de quem engaja — ' +
            'a carga real, que pode divergir da prescrita (D-085) e alimenta a evolucao ' +
            'por exercicio (D-092). A sessao pode ser concluida com ZERO registros: o ' +
            'check-in (presenca) e o sinal mais importante, e exigir serie a serie ' +
            'mataria a adesao. `workoutSetId` e opcional (serie livre, fora do ' +
            'prescrito) e, quando informado, tem de ser do treino desta sessao. Carga ' +
            'em colunas TIPADAS, inteiras: no maximo UMA grandeza por registro (D-081).',
          security: bearerAuth,
          params: workoutSessionParamsSchema,
          body: workoutLogSetSchema,
          response: {
            201: workoutSetLogViewSchema,
            401: problemDetailsSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            409: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const log = await service.logSet(
          request.headers.authorization,
          request.params.sessionId,
          request.body,
        );
        return reply.code(201).send(log);
      },
    );

    app.post(
      '/me/sessions/:sessionId/complete',
      {
        schema: {
          tags: TAGS,
          summary: 'CHECK-IN: conclui a sessao com a avaliacao (aluno)',
          description:
            'D-086 — concluir E o check-in do aluno, e o sinal de presenca que alimenta ' +
            'a aderencia (D-092) e as reguas de ausencia. O corpo carrega a AVALIACAO ' +
            '(obrigatoria — D-087: nota 1-5, esforco percebido, comentario e reacoes por ' +
            'CODIGO, com label/emoji no i18n) e MAIS NADA: nao ha campo de serie aqui de ' +
            'proposito. Concluir com zero `set-logs` e o caminho NORMAL. Status e ' +
            'avaliacao entram na MESMA transacao — nao existe sessao concluida sem ' +
            'avaliacao. O check-in acontece UMA vez (409 na segunda).',
          security: bearerAuth,
          params: workoutSessionParamsSchema,
          body: workoutCompleteSessionSchema,
          response: {
            200: workoutSessionDetailViewSchema,
            401: problemDetailsSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            409: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const session = await service.completeSession(
          request.headers.authorization,
          request.params.sessionId,
          request.body,
        );
        return reply.send(session);
      },
    );

    app.get(
      '/me/sessions',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista as sessoes de treino do ALUNO autenticado',
          description:
            'Linha do tempo da execucao (D-092), ordenada por `performedAt` desc. ' +
            'Historico nunca e apagado (D-100) — filtre pela janela.',
          security: bearerAuth,
          querystring: workoutSessionListQuerySchema,
          response: {
            200: workoutSessionListResultSchema,
            401: problemDetailsSchema,
            403: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const sessions = await service.listMySessions(request.headers.authorization, request.query);
        return reply.send({ sessions });
      },
    );

    app.get(
      '/me/sessions/:sessionId',
      {
        schema: {
          tags: TAGS,
          summary: 'Detalha uma sessao do ALUNO (series registradas + avaliacao)',
          security: bearerAuth,
          params: workoutSessionParamsSchema,
          response: {
            200: workoutSessionDetailViewSchema,
            401: problemDetailsSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const session = await service.getMySession(
          request.headers.authorization,
          request.params.sessionId,
        );
        return reply.send(session);
      },
    );

    app.get(
      '/me/adherence',
      {
        schema: {
          tags: TAGS,
          summary: 'Indicadores de aderencia do ALUNO no periodo (derivados)',
          description:
            'D-092: DERIVADO dos check-ins, sem entidade de agregacao propria. D-105: ' +
            'sessao de plano FIXO (alongamento/mobilidade, que roda POR CIMA dos demais) ' +
            'soma em `completedSessions` mas NAO em `adherenceSessions` — senao o ' +
            'alongamento infla a aderencia de quem nao treinou. NAO ha percentual: o ' +
            'denominador ("quantos treinos eram esperados") nao esta decidido em ADR ' +
            'nenhum, e um % com denominador inventado seria exibido como verdade.',
          security: bearerAuth,
          querystring: workoutAdherenceQuerySchema,
          response: {
            200: workoutAdherenceViewSchema,
            401: problemDetailsSchema,
            403: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const adherence = await service.getMyAdherence(
          request.headers.authorization,
          request.query,
        );
        return reply.send(adherence);
      },
    );

    // ---- Profissional: acompanhamento (SO LEITURA) --------------------------

    app.get(
      '/:tenantId/bonds/:bondId/sessions',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista as execucoes do aluno do vinculo (profissional, so leitura)',
          description:
            'D-092: o profissional ACOMPANHA — nao existe rota que o deixe concluir ' +
            'sessao ou registrar carga pelo aluno. Escopo duplo (tenant + vinculo dele).',
          security: bearerAuth,
          params: workoutBondParamsSchema,
          querystring: workoutSessionListQuerySchema,
          response: {
            200: workoutSessionListResultSchema,
            401: problemDetailsSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const sessions = await service.listBondSessions(
          request.headers.authorization,
          request.params.tenantId,
          request.params.bondId,
          request.query,
        );
        return reply.send({ sessions });
      },
    );

    app.get(
      '/:tenantId/bonds/:bondId/adherence',
      {
        schema: {
          tags: TAGS,
          summary: 'Aderencia do aluno do vinculo no periodo (profissional, so leitura)',
          description:
            'Mesmos numeros derivados de `/me/adherence` (D-092), pela otica de quem ' +
            'acompanha: e o insumo de "quem esta sumindo". Plano FIXO fora da aderencia ' +
            '(D-105).',
          security: bearerAuth,
          params: workoutBondParamsSchema,
          querystring: workoutAdherenceQuerySchema,
          response: {
            200: workoutAdherenceViewSchema,
            401: problemDetailsSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
            422: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const adherence = await service.getBondAdherence(
          request.headers.authorization,
          request.params.tenantId,
          request.params.bondId,
          request.query,
        );
        return reply.send(adherence);
      },
    );

    app.get(
      '/:tenantId/sessions/:sessionId',
      {
        schema: {
          tags: TAGS,
          summary: 'Detalha a execucao de um aluno (profissional, so leitura)',
          description:
            'Series registradas + avaliacao (D-087) — a avaliacao "muito dificil/facil" ' +
            'e sinal de ajuste da prescricao (D-092).',
          security: bearerAuth,
          params: professionalSessionParamsSchema,
          response: {
            200: workoutSessionDetailViewSchema,
            401: problemDetailsSchema,
            403: problemDetailsSchema,
            404: problemDetailsSchema,
          },
        },
      },
      async (request, reply) => {
        const session = await service.getBondSession(
          request.headers.authorization,
          request.params.tenantId,
          request.params.sessionId,
        );
        return reply.send(session);
      },
    );
  };
}

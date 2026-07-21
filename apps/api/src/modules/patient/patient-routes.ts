import {
  patientAcceptInviteResultSchema,
  patientAcceptInviteSchema,
  patientBondParamsSchema,
  patientCreateInviteResultSchema,
  patientCreateInviteSchema,
  patientInviteParamsSchema,
  patientOverviewResultSchema,
  patientTenantParamsSchema,
  problemDetailsSchema,
} from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { PatientApplicationService } from './patient-application-service';

const TAGS = ['patient'];
const bearerAuth = [{ bearerAuth: [] }];

/**
 * Vertical slice de paciente/vinculo (D-006/D-052/D-053/D-055; versao na URL /v1
 * — D-034). Convite profissional->paciente por especialidade: criar, visao
 * operacional (pendentes + vinculos ativos), reenviar (D-055), revogar e
 * arquivar vinculo (D-053). As rotas do profissional exigem perfil profissional
 * no tenant (guard no service — D-002); o aceite e publico (autorizado pelo token).
 *
 * D-032: schemas Zod de `@fitvo/validation` são a fonte única. Compilers Zod
 * escopados a este slice (contexto encapsulado).
 */
export function patientRoutes(service: PatientApplicationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.post(
      '/:tenantId/invites',
      {
        schema: {
          tags: TAGS,
          summary: 'Convida um paciente para uma especialidade (profissional)',
          description:
            'Cria um convite de uso unico direcionado a UMA especialidade (D-006/D-052), ' +
            'declarando a MODALIDADE do atendimento (D-101), que o vinculo herda no aceite. ' +
            'Requer perfil profissional no tenant que reivindica a especialidade-alvo E ' +
            'e-mail verificado (D-029). Devolve o token em claro UMA vez; o banco guarda ' +
            'apenas o hash.',
          security: bearerAuth,
          params: patientTenantParamsSchema,
          body: patientCreateInviteSchema,
          response: { 201: patientCreateInviteResultSchema, 403: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        const result = await service.createInvite(
          request.headers.authorization,
          request.params.tenantId,
          request.body,
        );
        return reply.code(201).send(result);
      },
    );

    app.get(
      '/:tenantId/overview',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista convites pendentes e vinculos ativos do profissional',
          description:
            'Visao OPERACIONAL do proprio profissional: convites pendentes + vinculos ' +
            'ativos (ADR-0001). Requer perfil profissional no tenant.',
          security: bearerAuth,
          params: patientTenantParamsSchema,
          response: { 200: patientOverviewResultSchema },
        },
      },
      async (request, reply) => {
        return reply.send(
          await service.listOverview(request.headers.authorization, request.params.tenantId),
        );
      },
    );

    app.post(
      '/:tenantId/invites/:inviteId/resend',
      {
        schema: {
          tags: TAGS,
          summary: 'Reenvia um convite pendente (profissional)',
          description:
            'Rotaciona o token e estende a validade na mesma linha (D-055). Devolve o ' +
            'novo token em claro UMA vez. Requer perfil profissional no tenant e e-mail ' +
            'verificado (D-029).',
          security: bearerAuth,
          params: patientInviteParamsSchema,
          response: { 201: patientCreateInviteResultSchema, 403: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        const result = await service.resendInvite(
          request.headers.authorization,
          request.params.tenantId,
          request.params.inviteId,
        );
        return reply.code(201).send(result);
      },
    );

    app.post(
      '/:tenantId/invites/:inviteId/revoke',
      {
        schema: {
          tags: TAGS,
          summary: 'Revoga um convite pendente (profissional)',
          description: 'Marca o convite como REVOKED. Requer perfil profissional no tenant.',
          security: bearerAuth,
          params: patientInviteParamsSchema,
        },
      },
      async (request, reply) => {
        await service.revokeInvite(
          request.headers.authorization,
          request.params.tenantId,
          request.params.inviteId,
        );
        return reply.code(204).send();
      },
    );

    app.post(
      '/:tenantId/bonds/:bondId/archive',
      {
        schema: {
          tags: TAGS,
          summary: 'Arquiva um vinculo ativo (profissional)',
          description:
            'ACTIVE -> ARCHIVED + archivedAt. NUNCA apaga: dados preservados (D-053). ' +
            'Requer perfil profissional no tenant.',
          security: bearerAuth,
          params: patientBondParamsSchema,
        },
      },
      async (request, reply) => {
        await service.archiveBond(
          request.headers.authorization,
          request.params.tenantId,
          request.params.bondId,
        );
        return reply.code(204).send();
      },
    );

    // Aceite publico — autorizado pelo proprio token de uso unico do convite.
    // Rate limit moderado: o aceite dispara hashing Argon2 (custo por chamada).
    app.post(
      '/invites/accept',
      {
        schema: {
          tags: TAGS,
          summary: 'Aceita um convite de paciente (publico, por token)',
          description:
            'Cria a conta+perfil de paciente (se novo) OU anexa/reusa o perfil na conta ' +
            'existente (multi-papel — D-041) e abre o vinculo na especialidade do convite. ' +
            'O token de uso unico e a autorizacao; nao requer Bearer.',
          body: patientAcceptInviteSchema,
          response: { 201: patientAcceptInviteResultSchema },
        },
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        return reply.code(201).send(await service.acceptInvite(request.body));
      },
    );
  };
}

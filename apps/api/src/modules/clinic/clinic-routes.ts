import {
  clinicAcceptInviteResultSchema,
  clinicAcceptInviteSchema,
  clinicCreateInviteResultSchema,
  clinicCreateInviteSchema,
  clinicInviteParamsSchema,
  clinicRosterResultSchema,
  clinicTenantParamsSchema,
  problemDetailsSchema,
} from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { ClinicApplicationService } from './clinic-application-service';

const TAGS = ['clinic'];
const bearerAuth = [{ bearerAuth: [] }];

/**
 * Vertical slice de clinica (D-034: versao na URL /v1). Convites
 * admin->profissional (D-014/D-048/D-049): criar, listar (operacional — D-015),
 * revogar e aceitar. As rotas administrativas exigem CLINIC_ADMIN do tenant
 * (guard no service — D-013); o aceite e publico (autorizado pelo token).
 *
 * D-032: schemas Zod de `@fitvo/validation` são a fonte única. Compilers Zod
 * escopados a este slice (contexto encapsulado).
 */
export function clinicRoutes(service: ClinicApplicationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.post(
      '/:tenantId/invites',
      {
        schema: {
          tags: TAGS,
          summary: 'Convida um profissional para a clinica (admin)',
          description:
            'Cria um convite de uso unico (D-014/D-048). Requer CLINIC_ADMIN do tenant e ' +
            'e-mail verificado (D-029). Devolve o token em claro UMA vez (entrega por ' +
            'e-mail e fase futura); o banco guarda apenas o hash.',
          security: bearerAuth,
          params: clinicTenantParamsSchema,
          body: clinicCreateInviteSchema,
          response: { 201: clinicCreateInviteResultSchema, 403: problemDetailsSchema },
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
      '/:tenantId/professionals',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista profissionais e convites pendentes da clinica (admin)',
          description:
            'Visao OPERACIONAL do corpo profissional + convites pendentes (D-015). ' +
            'Nunca expoe dado clinico. Requer CLINIC_ADMIN do tenant.',
          security: bearerAuth,
          params: clinicTenantParamsSchema,
          response: { 200: clinicRosterResultSchema },
        },
      },
      async (request, reply) => {
        return reply.send(
          await service.listRoster(request.headers.authorization, request.params.tenantId),
        );
      },
    );

    app.post(
      '/:tenantId/invites/:inviteId/revoke',
      {
        schema: {
          tags: TAGS,
          summary: 'Revoga um convite pendente (admin)',
          description: 'Marca o convite como REVOKED. Requer CLINIC_ADMIN do tenant.',
          security: bearerAuth,
          params: clinicInviteParamsSchema,
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

    // Aceite publico — autorizado pelo proprio token de uso unico do convite.
    // Rate limit moderado: o aceite dispara hashing Argon2 (custo por chamada).
    app.post(
      '/invites/accept',
      {
        schema: {
          tags: TAGS,
          summary: 'Aceita um convite de profissional (publico, por token)',
          description:
            'Cria a conta (se nova) OU vincula o perfil a conta existente, sempre no ' +
            'tenant da clinica do convite (D-048 — unica porta de entrada numa clinica). ' +
            'O token de uso unico e a autorizacao; nao requer Bearer.',
          body: clinicAcceptInviteSchema,
          response: { 201: clinicAcceptInviteResultSchema },
        },
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        return reply.code(201).send(await service.acceptInvite(request.body));
      },
    );
  };
}

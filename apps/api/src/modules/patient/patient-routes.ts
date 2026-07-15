import type { FastifyPluginAsync } from 'fastify';

import type { PatientApplicationService } from './patient-application-service';
import {
  acceptInviteRouteSchema,
  archiveBondRouteSchema,
  createInviteRouteSchema,
  overviewRouteSchema,
  resendInviteRouteSchema,
  revokeInviteRouteSchema,
} from './patient-openapi';
import {
  acceptInviteSchema,
  bondParamsSchema,
  createInviteSchema,
  inviteParamsSchema,
  tenantParamsSchema,
} from './patient-schemas';

/**
 * Vertical slice de paciente/vinculo (D-006/D-052/D-053/D-055; versao na URL /v1
 * — D-034). Convite profissional->paciente por especialidade: criar, visao
 * operacional (pendentes + vinculos ativos), reenviar (D-055), revogar e
 * arquivar vinculo (D-053). As rotas do profissional exigem perfil profissional
 * no tenant (guard no service — D-002); o aceite e publico (autorizado pelo
 * token). Zod valida corpo e parametros; OpenAPI documenta (D-032).
 */
export function patientRoutes(service: PatientApplicationService): FastifyPluginAsync {
  return (app) => {
    app.post('/:tenantId/invites', { schema: createInviteRouteSchema }, async (request, reply) => {
      const { tenantId } = tenantParamsSchema.parse(request.params);
      const body = createInviteSchema.parse(request.body);
      const result = await service.createInvite(request.headers.authorization, tenantId, body);
      return reply.code(201).send(result);
    });

    app.get('/:tenantId/overview', { schema: overviewRouteSchema }, async (request, reply) => {
      const { tenantId } = tenantParamsSchema.parse(request.params);
      return reply.send(await service.listOverview(request.headers.authorization, tenantId));
    });

    app.post(
      '/:tenantId/invites/:inviteId/resend',
      { schema: resendInviteRouteSchema },
      async (request, reply) => {
        const { tenantId, inviteId } = inviteParamsSchema.parse(request.params);
        const result = await service.resendInvite(
          request.headers.authorization,
          tenantId,
          inviteId,
        );
        return reply.code(201).send(result);
      },
    );

    app.post(
      '/:tenantId/invites/:inviteId/revoke',
      { schema: revokeInviteRouteSchema },
      async (request, reply) => {
        const { tenantId, inviteId } = inviteParamsSchema.parse(request.params);
        await service.revokeInvite(request.headers.authorization, tenantId, inviteId);
        return reply.code(204).send();
      },
    );

    app.post(
      '/:tenantId/bonds/:bondId/archive',
      { schema: archiveBondRouteSchema },
      async (request, reply) => {
        const { tenantId, bondId } = bondParamsSchema.parse(request.params);
        await service.archiveBond(request.headers.authorization, tenantId, bondId);
        return reply.code(204).send();
      },
    );

    // Aceite publico — autorizado pelo proprio token de uso unico do convite.
    // Rate limit moderado: o aceite dispara hashing Argon2 (custo por chamada).
    app.post(
      '/invites/accept',
      {
        schema: acceptInviteRouteSchema,
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        const body = acceptInviteSchema.parse(request.body);
        return reply.code(201).send(await service.acceptInvite(body));
      },
    );

    return Promise.resolve();
  };
}

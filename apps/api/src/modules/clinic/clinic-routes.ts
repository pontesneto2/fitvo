import type { FastifyPluginAsync } from 'fastify';

import type { ClinicApplicationService } from './clinic-application-service';
import {
  acceptInviteRouteSchema,
  createInviteRouteSchema,
  revokeInviteRouteSchema,
  rosterRouteSchema,
} from './clinic-openapi';
import {
  acceptInviteSchema,
  createInviteSchema,
  inviteParamsSchema,
  tenantParamsSchema,
} from './clinic-schemas';

/**
 * Vertical slice de clinica (D-034: versao na URL /v1). Convites
 * admin->profissional (D-014/D-048/D-049): criar, listar (operacional — D-015),
 * revogar e aceitar. As rotas administrativas exigem CLINIC_ADMIN do tenant
 * (guard no service — D-013); o aceite e publico (autorizado pelo token). Zod
 * valida corpo e parametros; OpenAPI documenta (D-032).
 */
export function clinicRoutes(service: ClinicApplicationService): FastifyPluginAsync {
  return (app) => {
    app.post('/:tenantId/invites', { schema: createInviteRouteSchema }, async (request, reply) => {
      const { tenantId } = tenantParamsSchema.parse(request.params);
      const body = createInviteSchema.parse(request.body);
      const result = await service.createInvite(request.headers.authorization, tenantId, body);
      return reply.code(201).send(result);
    });

    app.get('/:tenantId/professionals', { schema: rosterRouteSchema }, async (request, reply) => {
      const { tenantId } = tenantParamsSchema.parse(request.params);
      return reply.send(await service.listRoster(request.headers.authorization, tenantId));
    });

    app.post(
      '/:tenantId/invites/:inviteId/revoke',
      { schema: revokeInviteRouteSchema },
      async (request, reply) => {
        const { tenantId, inviteId } = inviteParamsSchema.parse(request.params);
        await service.revokeInvite(request.headers.authorization, tenantId, inviteId);
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

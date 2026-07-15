import type { FastifyPluginAsync } from 'fastify';

import type { ConsentApplicationService } from './consent-application-service';
import {
  grantConsentRouteSchema,
  listConsentsRouteSchema,
  revokeConsentRouteSchema,
} from './consent-openapi';
import { consentParamsSchema, grantConsentSchema } from './consent-schemas';

/**
 * Vertical slice de consentimento (D-016 — ADR-0003; versao na URL /v1 — D-034).
 * Todas as acoes sao do PACIENTE (titular do dado): conceder, listar e revogar
 * consentimento por (profissional que recebe + especialidade). O guard (no
 * service) exige perfil de paciente; NAO ha escopo de tenant (o consentimento
 * pode cruzar tenants). Zod valida corpo e parametros; OpenAPI documenta (D-032).
 */
export function consentRoutes(service: ConsentApplicationService): FastifyPluginAsync {
  return (app) => {
    app.post('/', { schema: grantConsentRouteSchema }, async (request, reply) => {
      const body = grantConsentSchema.parse(request.body);
      const result = await service.grantConsent(request.headers.authorization, body);
      return reply.code(201).send(result);
    });

    app.get('/', { schema: listConsentsRouteSchema }, async (request, reply) => {
      const consents = await service.listConsents(request.headers.authorization);
      return reply.send({ consents });
    });

    app.post('/:consentId/revoke', { schema: revokeConsentRouteSchema }, async (request, reply) => {
      const { consentId } = consentParamsSchema.parse(request.params);
      await service.revokeConsent(request.headers.authorization, consentId);
      return reply.code(204).send();
    });

    return Promise.resolve();
  };
}

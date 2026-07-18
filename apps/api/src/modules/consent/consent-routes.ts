import {
  consentParamsSchema,
  consentViewSchema,
  grantConsentSchema,
  listConsentsResultSchema,
} from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { ConsentApplicationService } from './consent-application-service';

const TAGS = ['consent'];
const bearerAuth = [{ bearerAuth: [] }];

/**
 * Vertical slice de consentimento (D-016 — ADR-0003; versao na URL /v1 — D-034).
 * Todas as acoes sao do PACIENTE (titular do dado): conceder, listar e revogar
 * consentimento por (profissional que recebe + especialidade). O guard (no
 * service) exige perfil de paciente; NAO ha escopo de tenant (o consentimento
 * pode cruzar tenants).
 *
 * D-032: schemas Zod de `@fitvo/validation` são a fonte única (validam + geram o
 * OpenAPI). Compilers Zod escopados a este slice (contexto encapsulado).
 */
export function consentRoutes(service: ConsentApplicationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.post(
      '/',
      {
        schema: {
          tags: TAGS,
          summary: 'Paciente concede consentimento a um profissional (por especialidade)',
          description:
            'O paciente (titular do dado) autoriza um profissional (grantee) a acessar ' +
            'os dados de UMA especialidade (D-016/ADR-0003). Exige vinculo ATIVO do ' +
            'paciente na especialidade. Bloqueia duplicata ativa (409); reabre um ' +
            'consentimento revogado. O consentimento e do paciente e pode cruzar tenants.',
          security: bearerAuth,
          body: grantConsentSchema,
          response: { 201: consentViewSchema },
        },
      },
      async (request, reply) => {
        const result = await service.grantConsent(request.headers.authorization, request.body);
        return reply.code(201).send(result);
      },
    );

    app.get(
      '/',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista os consentimentos do proprio paciente',
          description:
            'Consentimentos ATIVOS + historico revogado do paciente autenticado ' +
            '(D-016). Requer perfil de paciente.',
          security: bearerAuth,
          response: { 200: listConsentsResultSchema },
        },
      },
      async (request, reply) => {
        const consents = await service.listConsents(request.headers.authorization);
        return reply.send({ consents });
      },
    );

    app.post(
      '/:consentId/revoke',
      {
        schema: {
          tags: TAGS,
          summary: 'Paciente revoga um consentimento ativo',
          description: 'ACTIVE -> REVOKED + revokedAt. Requer perfil de paciente (titular).',
          security: bearerAuth,
          params: consentParamsSchema,
        },
      },
      async (request, reply) => {
        await service.revokeConsent(request.headers.authorization, request.params.consentId);
        return reply.code(204).send();
      },
    );
  };
}

import {
  problemDetailsSchema,
  receptionAcceptInviteResultSchema,
  receptionAcceptInviteSchema,
  receptionCreateInviteResultSchema,
  receptionCreateInviteSchema,
  receptionTenantParamsSchema,
} from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { ReceptionApplicationService } from './reception-application-service';

const TAGS = ['reception'];
const bearerAuth = [{ bearerAuth: [] }];

/**
 * Origem da requisicao do aceite (D-025) — IP/UA vem SEMPRE da requisicao, nunca
 * do corpo enviado pelo cliente (mesmo padrao de `intern-routes.ts`).
 */
function inviteAcceptOrigin(request: {
  ip: string;
  headers: Record<string, string | string[] | undefined>;
}): { ipAddress: string; userAgent: string } {
  const userAgent = request.headers['user-agent'];
  return {
    ipAddress: request.ip,
    userAgent: (Array.isArray(userAgent) ? userAgent[0] : userAgent) ?? 'unknown',
  };
}

/**
 * Vertical slice do seat de RECEPCAO (D-156 · D-034: versao na URL /v1). Convite
 * empresa->recepcao em duas fases: o admin pre-cadastra (Fase A, exige
 * CLINIC_ADMIN do tenant) e a recepcionista aceita por token (Fase B, publico).
 * NAO ha rota de autocadastro — recepcao so existe por convite (spec §1/§4.5).
 *
 * D-032: schemas Zod de `@fitvo/validation` sao a fonte unica.
 */
export function receptionRoutes(service: ReceptionApplicationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.post(
      '/:tenantId/invites',
      {
        schema: {
          tags: TAGS,
          summary: 'Pre-cadastra uma recepcionista (Fase A — admin)',
          description:
            'Cria um convite de uso unico para um seat ADMINISTRATIVO (D-156). Recepcao nao ' +
            'atende: nao ha profissao, conselho, especialidade nem responsavel no convite. ' +
            'Requer CLINIC_ADMIN do tenant e e-mail verificado (D-029). Devolve o token em ' +
            'claro UMA vez; o banco guarda apenas o hash.',
          security: bearerAuth,
          params: receptionTenantParamsSchema,
          body: receptionCreateInviteSchema,
          response: {
            201: receptionCreateInviteResultSchema,
            403: problemDetailsSchema,
            409: problemDetailsSchema,
          },
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

    // Aceite publico — autorizado pelo proprio token de uso unico do convite.
    // Rate limit moderado: o aceite dispara hashing Argon2 (custo por chamada).
    app.post(
      '/invites/accept',
      {
        schema: {
          tags: TAGS,
          summary: 'Aceita o convite de recepcao (Fase B — publico, por token)',
          description:
            'Cria a conta (se nova) OU vincula o seat a conta existente, sempre no tenant DO ' +
            'CONVITE. Campos completos (nascimento, endereco, WhatsApp) — por isso o seat ' +
            'nasce sem pendencia no gate de completar-perfil (spec §5). Grava o aceite dos ' +
            'termos (D-025) so no ramo de conta nova. O token de uso unico e a autorizacao; ' +
            'nao requer Bearer.',
          body: receptionAcceptInviteSchema,
          response: { 201: receptionAcceptInviteResultSchema, 409: problemDetailsSchema },
        },
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        return reply.code(201).send(
          await service.acceptInvite({
            token: request.body.token,
            password: request.body.password,
            name: request.body.name,
            socialName: request.body.socialName,
            gender: request.body.gender,
            document: request.body.document,
            documentType: request.body.documentType,
            whatsapp: request.body.whatsapp,
            birthDate: request.body.birthDate,
            address: request.body.address,
            origin: inviteAcceptOrigin(request),
          }),
        );
      },
    );
  };
}

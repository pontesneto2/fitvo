import {
  internAcceptInviteResultSchema,
  internAcceptInviteSchema,
  internCreateInviteResultSchema,
  internCreateInviteSchema,
  internSupervisorListResultSchema,
  internSupervisorQuerySchema,
  internTenantParamsSchema,
  problemDetailsSchema,
} from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { InternApplicationService } from './intern-application-service';

const TAGS = ['intern'];
const bearerAuth = [{ bearerAuth: [] }];

/**
 * Origem da requisicao do aceite (D-025) — IP/UA vem SEMPRE da requisicao, nunca
 * do corpo enviado pelo cliente (mesmo padrao de `clinic-routes.ts`).
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
 * Vertical slice do seat de ESTAGIARIO (D-142/D-143 · D-034: versao na URL /v1).
 * Convite empresa->estagiario em duas fases: a empresa pre-cadastra (Fase A,
 * exige CLINIC_ADMIN do tenant) e o estagiario aceita por token (Fase B,
 * publico). NAO ha rota de autocadastro — nao existe caminho pelo qual um
 * estagiario nasca sem convite, sem area e sem responsavel (spec §1/§6).
 *
 * D-032: schemas Zod de `@fitvo/validation` sao a fonte unica.
 */
export function internRoutes(service: InternApplicationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/:tenantId/supervisors',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista responsaveis elegiveis a supervisionar estagiario NA AREA (admin)',
          description:
            'Profissionais da empresa com o conselho DA AREA consultada e conselho preenchido ' +
            '(D-143): EDUCACAO_FISICA->CREF, NUTRICAO->CRN, MEDICINA->CRM. E a lista da Fase A ' +
            '— exatamente o conjunto que o convite aceita. A `area` e obrigatoria: sem ela a ' +
            'lista nao significa nada. Dado OPERACIONAL (D-015). Requer CLINIC_ADMIN do tenant.',
          security: bearerAuth,
          params: internTenantParamsSchema,
          querystring: internSupervisorQuerySchema,
          response: { 200: internSupervisorListResultSchema, 403: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        return reply.send(
          await service.listEligibleSupervisors(
            request.headers.authorization,
            request.params.tenantId,
            request.query.area,
          ),
        );
      },
    );

    app.post(
      '/:tenantId/invites',
      {
        schema: {
          tags: TAGS,
          summary: 'Pre-cadastra um estagiario (Fase A — admin)',
          description:
            'Cria um convite de uso unico com AREA e RESPONSAVEL obrigatorios (D-142/D-143): ' +
            'estagiario sem responsavel nao existe, e a area decide qual conselho o ' +
            'responsavel precisa ter. O responsavel deve ser elegivel neste tenant PARA ESTA ' +
            'AREA — 422 caso contrario (requisicao bem formada que falha em regra semantica ' +
            'contra o banco). Requer CLINIC_ADMIN do tenant e e-mail verificado (D-029). ' +
            'Devolve o token em claro UMA vez; o banco guarda apenas o hash.',
          security: bearerAuth,
          params: internTenantParamsSchema,
          body: internCreateInviteSchema,
          response: {
            201: internCreateInviteResultSchema,
            403: problemDetailsSchema,
            422: problemDetailsSchema,
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
          summary: 'Aceita o convite de estagiario (Fase B — publico, por token)',
          description:
            'Cria a conta (se nova) OU vincula o seat a conta existente, sempre no tenant e ' +
            'sob o RESPONSAVEL do convite — o estagiario nao escolhe quem o supervisiona. ' +
            'Grava o aceite dos termos (D-025) so no ramo de conta nova. O token de uso ' +
            'unico e a autorizacao; nao requer Bearer.',
          body: internAcceptInviteSchema,
          response: { 201: internAcceptInviteResultSchema },
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

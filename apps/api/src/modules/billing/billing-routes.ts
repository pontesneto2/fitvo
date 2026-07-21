import {
  billingTenantParamsSchema,
  chargeViewSchema,
  createChargeSchema,
  listPlansResultSchema,
  problemDetailsSchema,
  subscribeSchema,
  subscriptionViewSchema,
  walletViewSchema,
  webhookResultSchema,
} from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { BillingApplicationService } from './billing-application-service';

const TAGS = ['billing'];
const bearerAuth = [{ bearerAuth: [] }];

/** Header em que o Asaas envia o token do webhook (assinatura). */
const ASAAS_SIGNATURE_HEADER = 'asaas-access-token';

function firstHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

/**
 * Vertical slice de billing (ADR-0004; versao na URL /v1 — D-034). Fluxo A
 * (assinatura, guard dono/admin no service), Fluxo B (cobranca, guard
 * profissional dono do vinculo) e o webhook Asaas PUBLICO (assinado + idempotente).
 *
 * D-032: schemas Zod de `@fitvo/validation` são a fonte única. Compilers Zod
 * escopados a este slice. O corpo do webhook segue SEM schema (validado só pela
 * assinatura — gap conhecido do D-033, fora do escopo desta conversão).
 */
export function billingRoutes(service: BillingApplicationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    // Catalogo publico de planos (Fluxo A).
    app.get(
      '/plans',
      {
        schema: {
          tags: TAGS,
          summary: 'Catalogo publico de planos (Fluxo A)',
          description:
            'Planos Nivel 1 da plataforma (D-060). Publico. Os precos comerciais reais ' +
            'sao um input GATED (decisao humana) — o catalogo pode estar vazio ate a definicao.',
          response: { 200: listPlansResultSchema },
        },
      },
      async (_request, reply) => {
        return reply.send({ plans: await service.listPlans() });
      },
    );

    // Fluxo A: assinar / consultar assinatura (guard dono/admin no service).
    app.post(
      '/:tenantId/subscription',
      {
        schema: {
          tags: TAGS,
          summary: 'Assina um plano (dono/admin do tenant)',
          description:
            'Fluxo A (D-062): trial de 7 dias antes de cobrar. Requer dono/admin do tenant. ' +
            'idempotencyKey obrigatoria (D-035): um replay devolve a assinatura existente. ' +
            'O gateway Asaas e GATED — usa o FakePaymentGateway sem credenciais.',
          security: bearerAuth,
          params: billingTenantParamsSchema,
          body: subscribeSchema,
          response: { 201: subscriptionViewSchema },
        },
      },
      async (request, reply) => {
        const result = await service.subscribe(
          request.headers.authorization,
          request.params.tenantId,
          request.body,
        );
        return reply.code(201).send(result);
      },
    );

    app.get(
      '/:tenantId/subscription',
      {
        schema: {
          tags: TAGS,
          summary: 'Assinatura vigente do tenant (dono/admin)',
          security: bearerAuth,
          params: billingTenantParamsSchema,
          response: { 200: subscriptionViewSchema },
        },
      },
      async (request, reply) => {
        return reply.send(
          await service.getSubscription(request.headers.authorization, request.params.tenantId),
        );
      },
    );

    // Fluxo B: emitir cobranca (guard profissional dono do vinculo no service).
    app.post(
      '/:tenantId/charges',
      {
        schema: {
          tags: TAGS,
          summary: 'Emite uma cobranca contra um vinculo (profissional)',
          description:
            'Fluxo B (D-019): o profissional dono do vinculo cobra o paciente via split ' +
            '(subconta do profissional + taxa FITVO). Valor em centavos (D-069). ' +
            'idempotencyKey obrigatoria (D-035). Requer e-mail verificado (D-029). Asaas ' +
            'GATED — usa o FakePaymentGateway.',
          security: bearerAuth,
          params: billingTenantParamsSchema,
          body: createChargeSchema,
          response: { 201: chargeViewSchema, 403: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        const result = await service.createCharge(
          request.headers.authorization,
          request.params.tenantId,
          request.body,
        );
        return reply.code(201).send(result);
      },
    );

    // Carteira/extrato (guard dono/admin no service).
    app.get(
      '/:tenantId/wallet',
      {
        schema: {
          tags: TAGS,
          summary: 'Extrato da carteira do tenant (dono/admin)',
          description:
            'Recebido / a receber / taxas, agregados das cobrancas (D-061). Centavos (D-069).',
          security: bearerAuth,
          params: billingTenantParamsSchema,
          response: { 200: walletViewSchema },
        },
      },
      async (request, reply) => {
        return reply.send(
          await service.getWallet(request.headers.authorization, request.params.tenantId),
        );
      },
    );

    // Webhook Asaas: PUBLICO (autorizado pela assinatura), idempotente (D-035).
    // Rate limit dedicado mais alto: o Asaas pode reentregar em rajada. Sem
    // schema de body: o payload cru vai ao service, validado pela assinatura.
    app.post(
      '/webhooks/asaas',
      {
        schema: {
          tags: TAGS,
          summary: 'Webhook Asaas (publico, assinado, idempotente)',
          description:
            'Recebe eventos do Asaas (D-035): assinatura validada pelo gateway, dedupe ' +
            'idempotente pelo ledger (evento reentregue = no-op) e atualizacao de status. ' +
            'Rate limit dedicado. Sem credenciais Asaas, a validacao usa o FakePaymentGateway.',
          response: { 200: webhookResultSchema },
        },
        config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        const signature = firstHeader(request.headers[ASAAS_SIGNATURE_HEADER]);
        const result = await service.handleWebhook(request.body, signature);
        return reply.send(result);
      },
    );
  };
}

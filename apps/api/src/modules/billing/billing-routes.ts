import type { FastifyPluginAsync } from 'fastify';

import type { BillingApplicationService } from './billing-application-service';
import {
  createChargeRouteSchema,
  getSubscriptionRouteSchema,
  getWalletRouteSchema,
  listPlansRouteSchema,
  subscribeRouteSchema,
  webhookRouteSchema,
} from './billing-openapi';
import { createChargeSchema, subscribeSchema, tenantParamsSchema } from './billing-schemas';

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
 * Zod valida corpo e parametros; OpenAPI documenta (D-032).
 */
export function billingRoutes(service: BillingApplicationService): FastifyPluginAsync {
  return (app) => {
    // Catalogo publico de planos (Fluxo A).
    app.get('/plans', { schema: listPlansRouteSchema }, async (_request, reply) => {
      return reply.send({ plans: await service.listPlans() });
    });

    // Fluxo A: assinar / consultar assinatura (guard dono/admin no service).
    app.post(
      '/:tenantId/subscription',
      { schema: subscribeRouteSchema },
      async (request, reply) => {
        const { tenantId } = tenantParamsSchema.parse(request.params);
        const body = subscribeSchema.parse(request.body);
        const result = await service.subscribe(request.headers.authorization, tenantId, body);
        return reply.code(201).send(result);
      },
    );

    app.get(
      '/:tenantId/subscription',
      { schema: getSubscriptionRouteSchema },
      async (request, reply) => {
        const { tenantId } = tenantParamsSchema.parse(request.params);
        return reply.send(await service.getSubscription(request.headers.authorization, tenantId));
      },
    );

    // Fluxo B: emitir cobranca (guard profissional dono do vinculo no service).
    app.post('/:tenantId/charges', { schema: createChargeRouteSchema }, async (request, reply) => {
      const { tenantId } = tenantParamsSchema.parse(request.params);
      const body = createChargeSchema.parse(request.body);
      const result = await service.createCharge(request.headers.authorization, tenantId, body);
      return reply.code(201).send(result);
    });

    // Carteira/extrato (guard dono/admin no service).
    app.get('/:tenantId/wallet', { schema: getWalletRouteSchema }, async (request, reply) => {
      const { tenantId } = tenantParamsSchema.parse(request.params);
      return reply.send(await service.getWallet(request.headers.authorization, tenantId));
    });

    // Webhook Asaas: PUBLICO (autorizado pela assinatura), idempotente (D-035).
    // Rate limit dedicado mais alto: o Asaas pode reentregar em rajada.
    app.post(
      '/webhooks/asaas',
      {
        schema: webhookRouteSchema,
        config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        const signature = firstHeader(request.headers[ASAAS_SIGNATURE_HEADER]);
        const result = await service.handleWebhook(request.body, signature);
        return reply.send(result);
      },
    );

    return Promise.resolve();
  };
}

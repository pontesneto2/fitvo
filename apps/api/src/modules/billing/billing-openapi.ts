/**
 * Schemas OpenAPI/JSON das rotas de billing (D-032). O Zod (billing-schemas.ts)
 * segue como validador autoritativo nos handlers; aqui documentamos entrada e
 * saida e alimentamos o /docs. Dinheiro sempre em centavos inteiros (D-069).
 */

const TAGS = ['billing'];
const bearerAuth = [{ bearerAuth: [] }];

const tenantParams = {
  type: 'object',
  required: ['tenantId'],
  properties: { tenantId: { type: 'string', description: 'ID do tenant.' } },
};

const periodicityEnum = { type: 'string', enum: ['monthly', 'quarterly', 'biannual', 'annual'] };
const methodEnum = { type: 'string', enum: ['boleto', 'pix', 'credit_card'] };

const planSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    code: { type: 'string' },
    name: { type: 'string' },
    tier: { type: 'string' },
    prices: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          periodicity: periodicityEnum,
          amountCents: { type: 'integer', description: 'Preco em centavos (D-069).' },
        },
        required: ['periodicity', 'amountCents'],
      },
    },
  },
  required: ['id', 'code', 'name', 'tier', 'prices'],
};

const subscriptionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    planId: { type: 'string' },
    periodicity: periodicityEnum,
    status: { type: 'string', enum: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'] },
    currentPeriodEnd: { type: ['string', 'null'], format: 'date-time' },
    trialEndsAt: { type: ['string', 'null'], format: 'date-time' },
  },
  required: ['id', 'planId', 'periodicity', 'status'],
};

const chargeSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    bondId: { type: 'string' },
    amountCents: { type: 'integer' },
    method: methodEnum,
    status: {
      type: 'string',
      enum: ['PENDING', 'CONFIRMED', 'RECEIVED', 'OVERDUE', 'REFUNDED', 'FAILED'],
    },
    recurring: { type: 'boolean' },
    periodicity: { ...periodicityEnum, nullable: true },
    platformFeeCents: { type: 'integer', description: 'Taxa FITVO retida, em centavos (D-061).' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id',
    'bondId',
    'amountCents',
    'method',
    'status',
    'recurring',
    'platformFeeCents',
    'createdAt',
  ],
};

export const listPlansRouteSchema = {
  tags: TAGS,
  summary: 'Catalogo publico de planos (Fluxo A)',
  description:
    'Planos Nivel 1 da plataforma (D-060). Publico. Os precos comerciais reais ' +
    'sao um input GATED (decisao humana) — o catalogo pode estar vazio ate a definicao.',
  response: {
    200: {
      type: 'object',
      properties: { plans: { type: 'array', items: planSchema } },
      required: ['plans'],
    },
  },
};

export const subscribeRouteSchema = {
  tags: TAGS,
  summary: 'Assina um plano (dono/admin do tenant)',
  description:
    'Fluxo A (D-062): trial de 7 dias antes de cobrar. Requer dono/admin do tenant. ' +
    'idempotencyKey obrigatoria (D-035): um replay devolve a assinatura existente. ' +
    'O gateway Asaas e GATED — usa o FakePaymentGateway sem credenciais.',
  security: bearerAuth,
  params: tenantParams,
  body: {
    type: 'object',
    required: ['planId', 'periodicity', 'idempotencyKey'],
    properties: {
      planId: { type: 'string' },
      periodicity: periodicityEnum,
      idempotencyKey: { type: 'string', minLength: 8, maxLength: 200 },
    },
  },
  response: { 201: subscriptionSchema },
};

export const getSubscriptionRouteSchema = {
  tags: TAGS,
  summary: 'Assinatura vigente do tenant (dono/admin)',
  security: bearerAuth,
  params: tenantParams,
  response: { 200: subscriptionSchema },
};

export const createChargeRouteSchema = {
  tags: TAGS,
  summary: 'Emite uma cobranca contra um vinculo (profissional)',
  description:
    'Fluxo B (D-019): o profissional dono do vinculo cobra o paciente via split ' +
    '(subconta do profissional + taxa FITVO). Valor em centavos (D-069). ' +
    'idempotencyKey obrigatoria (D-035). Asaas GATED — usa o FakePaymentGateway.',
  security: bearerAuth,
  params: tenantParams,
  body: {
    type: 'object',
    required: ['bondId', 'amountCents', 'method', 'idempotencyKey'],
    properties: {
      bondId: { type: 'string' },
      amountCents: { type: 'integer', minimum: 1, description: 'Valor em centavos (D-069).' },
      method: methodEnum,
      idempotencyKey: { type: 'string', minLength: 8, maxLength: 200 },
      description: { type: 'string', maxLength: 500 },
      dueDate: { type: 'string', format: 'date-time' },
      recurring: { type: 'boolean' },
      periodicity: periodicityEnum,
    },
  },
  response: { 201: chargeSchema },
};

export const getWalletRouteSchema = {
  tags: TAGS,
  summary: 'Extrato da carteira do tenant (dono/admin)',
  description: 'Recebido / a receber / taxas, agregados das cobrancas (D-061). Centavos (D-069).',
  security: bearerAuth,
  params: tenantParams,
  response: {
    200: {
      type: 'object',
      properties: {
        receivedCents: { type: 'integer' },
        pendingCents: { type: 'integer' },
        feesCents: { type: 'integer' },
      },
      required: ['receivedCents', 'pendingCents', 'feesCents'],
    },
  },
};

export const webhookRouteSchema = {
  tags: TAGS,
  summary: 'Webhook Asaas (publico, assinado, idempotente)',
  description:
    'Recebe eventos do Asaas (D-035): assinatura validada pelo gateway, dedupe ' +
    'idempotente pelo ledger (evento reentregue = no-op) e atualizacao de status. ' +
    'Rate limit dedicado. Sem credenciais Asaas, a validacao usa o FakePaymentGateway.',
  response: {
    200: {
      type: 'object',
      properties: { received: { type: 'boolean' }, duplicate: { type: 'boolean' } },
      required: ['received', 'duplicate'],
    },
  },
};

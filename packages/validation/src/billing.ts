import { z } from 'zod';

/**
 * Contrato de billing (ADR-0004/D-032) — fonte única. Dinheiro SEMPRE em
 * centavos inteiros (D-069). O service já entrega timestamps como ISO string;
 * `status` de assinatura/cobrança é o enum Prisma (o view foi estreitado no
 * D-032.2 para casar com este contrato). `billingTenantParams` é prefixado
 * (colide com clinic/patient no barrel flat).
 */

const periodicity = z.enum(['monthly', 'quarterly', 'biannual', 'annual']);
const method = z.enum(['boleto', 'pix', 'credit_card']);

// ---- Params / Request ----
export const billingTenantParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant.'),
});

export const subscribeSchema = z.object({
  planId: z.string().min(1),
  periodicity,
  idempotencyKey: z.string().min(8).max(200),
});

export const createChargeSchema = z.object({
  bondId: z.string().min(1),
  amountCents: z.number().int().positive().describe('Valor em centavos (D-069).'),
  method,
  idempotencyKey: z.string().min(8).max(200),
  description: z.string().max(500).optional(),
  dueDate: z.iso.datetime().optional(),
  recurring: z.boolean().optional(),
  periodicity: periodicity.optional(),
});

// ---- Response ----
export const planViewSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  tier: z.string(),
  prices: z.array(
    z.object({
      periodicity,
      amountCents: z.number().int().describe('Preco em centavos (D-069).'),
    }),
  ),
});

export const listPlansResultSchema = z.object({ plans: z.array(planViewSchema) });

export const subscriptionViewSchema = z.object({
  id: z.string(),
  planId: z.string(),
  periodicity,
  status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED']),
  currentPeriodEnd: z.iso.datetime().nullable(),
  trialEndsAt: z.iso.datetime().nullable(),
});

export const chargeViewSchema = z.object({
  id: z.string(),
  bondId: z.string(),
  amountCents: z.number().int(),
  method,
  status: z.enum(['PENDING', 'CONFIRMED', 'RECEIVED', 'OVERDUE', 'REFUNDED', 'FAILED']),
  recurring: z.boolean(),
  periodicity: periodicity.nullable(),
  platformFeeCents: z.number().int().describe('Taxa FITVO retida, em centavos (D-061).'),
  createdAt: z.iso.datetime(),
});

export const walletViewSchema = z.object({
  receivedCents: z.number().int(),
  pendingCents: z.number().int(),
  feesCents: z.number().int(),
});

export const webhookResultSchema = z.object({
  received: z.boolean(),
  duplicate: z.boolean(),
});

// ---- Tipos de wire ----
export type BillingTenantParams = z.infer<typeof billingTenantParamsSchema>;
export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type CreateChargeInput = z.infer<typeof createChargeSchema>;
export type PlanView = z.infer<typeof planViewSchema>;
export type ListPlansResult = z.infer<typeof listPlansResultSchema>;
export type SubscriptionView = z.infer<typeof subscriptionViewSchema>;
export type ChargeView = z.infer<typeof chargeViewSchema>;
export type WalletView = z.infer<typeof walletViewSchema>;
export type WebhookResult = z.infer<typeof webhookResultSchema>;

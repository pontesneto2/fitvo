import { z } from 'zod';

/** Parametro de rota: tenant alvo da operacao financeira. */
export const tenantParamsSchema = z.object({
  tenantId: z.string().min(1),
});

const periodicitySchema = z.enum(['monthly', 'quarterly', 'biannual', 'annual']);
const methodSchema = z.enum(['boleto', 'pix', 'credit_card']);

/**
 * Corpo da assinatura (Fluxo A — D-062). idempotencyKey OBRIGATORIA em toda
 * operacao financeira (D-035): o cliente a gera e um replay devolve a existente.
 */
export const subscribeSchema = z.object({
  planId: z.string().min(1),
  periodicity: periodicitySchema,
  idempotencyKey: z.string().min(8).max(200),
});

/**
 * Corpo da cobranca (Fluxo B — D-019). Valor SEMPRE em centavos inteiros
 * positivos (D-069) — nunca float. idempotencyKey obrigatoria (D-035).
 */
export const createChargeSchema = z.object({
  bondId: z.string().min(1),
  amountCents: z.number().int().positive(),
  method: methodSchema,
  idempotencyKey: z.string().min(8).max(200),
  description: z.string().max(500).optional(),
  dueDate: z.string().datetime().optional(),
  recurring: z.boolean().optional(),
  periodicity: periodicitySchema.optional(),
});

import { z } from 'zod';

/**
 * Erros tipados compartilhados (D-032/D-031). O corpo de erro é sempre um
 * ProblemDetails (RFC 7807).
 */

/**
 * Forma genérica de um ProblemDetails (RFC 7807) — usada como `response` nas
 * rotas onde o MESMO status code pode carregar mais de um `type` de erro (ex.:
 * 403 tanto por RBAC quanto pelo gate de e-mail verificado). Um schema com
 * `type`/`title` literais quebraria a serialização Zod dos OUTROS erros que
 * batem no mesmo status.
 */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

/**
 * 403 — a conta está autenticada, mas o e-mail ainda não foi verificado
 * (D-029). Gate de ações sensíveis (convidar, financeiro, clínico); nunca
 * bloqueia login. Forma ESPECÍFICA (não usada em `response` — ver
 * `problemDetailsSchema` acima) para o front tipar o narrowing pelo `type`
 * quando já sabe que é este erro.
 */
export const emailNotVerifiedProblemSchema = z.object({
  type: z.literal('https://fitvo.dev/problems/email-not-verified'),
  title: z.literal('E-mail nao verificado'),
  status: z.literal(403),
  detail: z.string(),
});

export type EmailNotVerifiedProblem = z.infer<typeof emailNotVerifiedProblemSchema>;

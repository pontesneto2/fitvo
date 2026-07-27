import { z } from 'zod';

/**
 * Contrato de autenticação (D-032) — FONTE ÚNICA.
 *
 * Os mesmos schemas Zod deste arquivo:
 *  - validam o request no Fastify (via `fastify-type-provider-zod`);
 *  - geram o OpenAPI (/docs) por DERIVAÇÃO (`z.toJSONSchema`), não por um
 *    segundo JSON Schema escrito à mão que pode divergir em silêncio;
 *  - inferem os tipos de wire consumidos pela API e por web/mobile.
 *
 * Timestamps são **ISO string no fio** (`z.iso.datetime()`). O domínio
 * (`@fitvo/auth`) devolve `Date`; o handler converte no boundary. Antes, o
 * `fast-json-stringify` fazia essa conversão escondido via `format: date-time`;
 * aqui ela é explícita — a mesma medida vale para o serializer do Zod, que não
 * converte `Date` sozinho.
 */

// Campos reutilizados — a descrição alimenta o /docs.
const email = z.string().email().describe('E-mail de login (único) — D-042.');
const password = z.string().min(8).describe('Senha em claro (mín. 8).');
const oneTimeToken = z.string().min(1).describe('Token de uso único recebido por e-mail.');

/**
 * Aceite OBRIGATÓRIO dos dois termos no cadastro (D-025 — LGPD). Cada campo
 * exige o literal booleano `true` — não `false`, ausente ou qualquer outro
 * valor. Isso torna uma caixa "pré-marcada" ou desmarcada IRREPRESENTÁVEL no
 * request: o cliente precisa enviar `true` explicitamente por documento, ou o
 * Zod rejeita com 400 antes de qualquer conta ser criada.
 */
export const acceptedTerms = z
  .object({
    termsOfUse: z.literal(true).describe('Aceite explícito dos Termos de Uso.'),
    privacyPolicy: z.literal(true).describe('Aceite explícito da Política de Privacidade.'),
  })
  .describe('Aceite dos termos no cadastro (D-025) — ambos obrigatoriamente `true`.');

// ---------------------------------------------------------------------------
// Requests (regras IDÊNTICAS ao antigo apps/api/.../auth-schemas.ts — só mudou
// o lugar: o contrato agora é compartilhado).
// ---------------------------------------------------------------------------

export const registerProfessionalSchema = z.object({
  email,
  password,
  name: z.string().min(1),
  document: z.string().min(11).max(18).describe('CPF ou CNPJ (D-043).'),
  documentType: z.enum(['CPF', 'CNPJ']),
  tenantName: z.string().min(1),
  acceptedTerms,
});

export const loginSchema = z.object({
  email,
  // Login aceita senha de qualquer tamanho (não é cadastro): min(1), não min(8).
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const requestEmailVerificationSchema = z.object({ email });

export const verifyEmailSchema = z.object({ token: oneTimeToken });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ token: oneTimeToken, password });

// ---------------------------------------------------------------------------
// Responses (novo — antes só existiam como JSON Schema à mão em auth-openapi.ts).
// ---------------------------------------------------------------------------

export const tokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessExpiresAt: z.iso.datetime(),
  refreshExpiresAt: z.iso.datetime(),
});

export const accountSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});

export const authResultSchema = z.object({
  account: accountSummarySchema,
  tokens: tokensSchema,
});

export const refreshResultSchema = z.object({ tokens: tokensSchema });

export const meResultSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  emailVerified: z.boolean(),
});

/** Resposta 202 que não revela existência de conta (D-029): sempre `accepted`. */
export const acceptedResultSchema = z.object({ status: z.literal('accepted') });

export const emailVerifiedResultSchema = z.object({ verified: z.boolean() });

// ---------------------------------------------------------------------------
// Tipos de wire inferidos (o que atravessa a rede — timestamps são string).
// ---------------------------------------------------------------------------

export type RegisterProfessionalInput = z.infer<typeof registerProfessionalSchema>;
export type AcceptedTerms = z.infer<typeof acceptedTerms>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type RequestEmailVerificationInput = z.infer<typeof requestEmailVerificationSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export type Tokens = z.infer<typeof tokensSchema>;
export type AccountSummary = z.infer<typeof accountSummarySchema>;
export type AuthResult = z.infer<typeof authResultSchema>;
export type RefreshResult = z.infer<typeof refreshResultSchema>;
export type MeResult = z.infer<typeof meResultSchema>;
export type AcceptedResult = z.infer<typeof acceptedResultSchema>;
export type EmailVerifiedResult = z.infer<typeof emailVerifiedResultSchema>;

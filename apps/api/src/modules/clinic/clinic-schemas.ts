import { z } from 'zod';

/** Parametro de rota: tenant (clinica) alvo da operacao administrativa. */
export const tenantParamsSchema = z.object({
  tenantId: z.string().min(1),
});

/** Parametros de rota: clinica + convite. */
export const inviteParamsSchema = z.object({
  tenantId: z.string().min(1),
  inviteId: z.string().min(1),
});

/** Corpo do convite: apenas o e-mail do profissional convidado (D-014). */
export const createInviteSchema = z.object({
  email: z.string().email(),
});

/**
 * Corpo do aceite. O e-mail vem do CONVITE (autoritativo — o token prova o
 * controle do e-mail), nao do corpo. Documento do profissional = CPF ou CNPJ
 * (D-043). Para conta nova, senha/nome/documento sao usados; para conta ja
 * existente (multi-papel — D-041), o perfil e apenas vinculado.
 */
export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  name: z.string().min(1),
  document: z.string().min(11).max(18),
  documentType: z.enum(['CPF', 'CNPJ']),
});

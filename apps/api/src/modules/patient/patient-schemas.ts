import { z } from 'zod';

/** Parametro de rota: tenant (do profissional) alvo da operacao. */
export const tenantParamsSchema = z.object({
  tenantId: z.string().min(1),
});

/** Parametros de rota: tenant + convite. */
export const inviteParamsSchema = z.object({
  tenantId: z.string().min(1),
  inviteId: z.string().min(1),
});

/** Parametros de rota: tenant + vinculo. */
export const bondParamsSchema = z.object({
  tenantId: z.string().min(1),
  bondId: z.string().min(1),
});

/**
 * Corpo do convite profissional->paciente (D-006): e-mail do paciente + a
 * especialidade-alvo do futuro vinculo (D-052) + a MODALIDADE do atendimento
 * (D-101). Um convite = uma especialidade.
 *
 * A modalidade e obrigatoria e vem do PROFISSIONAL: e ele quem sabe como atende,
 * o paciente nao escolhe a modalidade do servico que contrata (D-101). Sem
 * default — nenhum ADR elegeu uma modalidade padrao, e adivinhar aqui seria
 * inventar regra de negocio.
 */
export const createInviteSchema = z.object({
  email: z.string().email(),
  specialtyId: z.string().min(1),
  modality: z.enum(['ONLINE', 'PRESENCIAL', 'HIBRIDO']),
});

/**
 * Corpo do aceite. O e-mail vem do CONVITE (autoritativo — o token prova o
 * controle do e-mail), nao do corpo. Paciente = CPF (D-043). Para conta nova,
 * senha/nome/documento sao usados; para conta ja existente (multi-papel — D-041),
 * o perfil e apenas anexado/reusado e o vinculo aberto.
 */
export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  name: z.string().min(1),
  document: z.string().min(11).max(14),
});

import { z } from 'zod';

import {
  acceptedTerms,
  addressSchema,
  birthDate,
  genderSchema,
  socialName,
  strongPassword,
  whatsapp,
} from './auth';
import { cpfXorCnpjRefine, documentDigits } from './document';

/**
 * Contrato do seat de RECEPÇÃO (D-156 — ADR-0015, spec §2/§4.5). Prefixo
 * `reception*` porque o barrel de `@fitvo/validation` é flat.
 *
 * Recepção é um seat **administrativo**: opera agenda e cadastro — dado
 * OPERACIONAL (D-015) — e **NUNCA** acessa dado clínico (anamnese, avaliação,
 * prontuário, prescrição). Como o profissional de clínica (#102) e o estagiário
 * (D-142), entra por convite em duas fases e **nunca** por autocadastro (spec
 * §1); diferente dos dois, **não tem conselho, especialidade nem supervisor**:
 *
 * 1. **Não informa conselho nem especialidade** — não são campos ausentes por
 *    esquecimento, são campos que não existem: os dois qualificam quem ATENDE, e
 *    recepção não atende. Declará-los sugeriria uma capacidade clínica que este
 *    seat não tem.
 * 2. **Não tem responsável** — diferente do estagiário, cuja capacidade DERIVA
 *    do conselho do supervisor (D-142). Recepção não exerce atividade
 *    regulamentada, então não há o que supervisionar.
 *
 * O rótulo do seat (`RECEPTION`) vive AQUI, no DTO — não há coluna `seatType` no
 * banco: a existência da linha `reception_profile` já é o fato (mesma doutrina
 * de `InternProfile`, D-103).
 */

/** Rótulo do seat, exposto na API. Ver nota acima sobre não haver coluna. */
export const receptionSeatTypeSchema = z
  .literal('RECEPTION')
  .describe('Tipo de seat — recepção administrativa (D-156).');

// ---- Params / Request ----

export const receptionTenantParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant da empresa (clínica ou academia).'),
});

/**
 * Fase A — o admin pré-cadastra a recepcionista. Campos mínimos: para onde vai
 * o convite e, opcionalmente, o nome que facilita identificá-lo. Sem profissão,
 * sem conselho, sem especialidade, sem responsável: recepção não tem nenhum dos
 * quatro.
 */
export const receptionCreateInviteSchema = z.object({
  email: z.string().email().describe('E-mail da recepcionista convidada.'),
  name: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Nome informado pela empresa — facilita o convite; o civil vem no aceite.'),
});

/**
 * Fase B — a recepcionista aceita e completa a identidade. Mesmos campos de
 * pessoa do aceite de estagiário (spec §4.8), MENOS área e responsável.
 *
 * Campos COMPLETOS de propósito (spec §4.5): quem é pré-cadastrado por terceiro
 * preenche tudo aqui, no momento em que já está engajado — e por isso nasce com
 * `profileComplete` verdadeiro, sem cair no gate de completar-perfil (spec §5).
 * A alternativa (pedir menos agora, cobrar depois) troca fricção de cadastro por
 * fricção de primeiro login, que é pior.
 *
 * **Sem sexo biológico**: é variável fisiológica, base de cálculo metabólico e
 * de faixa de referência (spec §3.1) — captura-se de PACIENTE, de quem se
 * calcula algo. De recepção não se calcula nada.
 *
 * Aceita os termos (D-025): sem `acceptedTerms` a conta não nasce; a gravação
 * acontece **só** no ramo de conta nova.
 */
export const receptionAcceptInviteSchema = z
  .object({
    token: z.string().min(1).describe('Token de uso único recebido no convite.'),
    password: strongPassword,
    name: z.string().min(1).describe('Nome civil da recepcionista.'),
    socialName,
    gender: genderSchema.optional().describe('Gênero/identidade — opcional (spec §3.1).'),
    document: documentDigits,
    documentType: z.enum(['CPF', 'CNPJ']),
    whatsapp,
    birthDate,
    address: addressSchema,
    acceptedTerms,
  })
  // CPF-xor-CNPJ com dígito verificador REAL (D-043/spec §3) — a mesma peça
  // compartilhada de `document.ts` que autônomo, clínica, estagiário e paciente
  // usam. Um schema novo não tem como nascer validando só comprimento (#113).
  .superRefine(cpfXorCnpjRefine);

// ---- Response ----

export const receptionInviteViewSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const receptionCreateInviteResultSchema = z.object({
  invite: receptionInviteViewSchema,
  token: z.string(),
});

/**
 * Resultado do aceite. Devolve o `seatType` junto do tenant: quem consome a API
 * vê, na mesma resposta, que este seat é administrativo — e portanto que não há
 * conselho nem especialidade a esperar dele.
 */
export const receptionAcceptInviteResultSchema = z.object({
  reception: z.object({
    accountId: z.string(),
    tenantId: z.string(),
    seatType: receptionSeatTypeSchema,
  }),
  created: z.boolean(),
});

// ---- Tipos de wire ----
export type ReceptionSeatType = z.infer<typeof receptionSeatTypeSchema>;
export type ReceptionTenantParams = z.infer<typeof receptionTenantParamsSchema>;
export type ReceptionCreateInviteInput = z.infer<typeof receptionCreateInviteSchema>;
export type ReceptionAcceptInviteInput = z.infer<typeof receptionAcceptInviteSchema>;
export type ReceptionInviteView = z.infer<typeof receptionInviteViewSchema>;
export type ReceptionCreateInviteResult = z.infer<typeof receptionCreateInviteResultSchema>;
export type ReceptionAcceptInviteResult = z.infer<typeof receptionAcceptInviteResultSchema>;

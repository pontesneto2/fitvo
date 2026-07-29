import { z } from 'zod';

import {
  acceptedTerms,
  addressSchema,
  birthDate,
  brazilianStateSchema,
  genderSchema,
  socialName,
  strongPassword,
  whatsapp,
} from './auth';
import { cpfXorCnpjRefine, documentDigits } from './document';
import { specialtyCodeSchema } from './specialty';

/**
 * Contrato do seat de ESTAGIÁRIO (D-142/D-143) — fonte única. Prefixo `intern*`
 * porque o barrel de `@fitvo/validation` é flat.
 *
 * O estagiário **NUNCA** é autocadastro (spec §1/§6): é estudante, não tem
 * conselho, e atuar sem supervisão é exercício ilegal da profissão (art. 47
 * DL 3.688/1941). Por isso o fluxo é o de convite em duas fases — o mesmo molde
 * do profissional de clínica (#102) —, com três diferenças que são a regra
 * legal inteira:
 *
 * 1. **Não informa conselho** — nem no convite, nem no aceite, em NENHUMA área.
 *    Não existe o campo: estudante não tem registro em conselho.
 * 2. **Declara uma ÁREA** — a empresa define no convite. A área é o que decide
 *    QUAL conselho o responsável precisa ter (D-143).
 * 3. **Responsável obrigatório** — `supervisorProfessionalProfileId` é
 *    obrigatório já no convite, e NOT NULL no banco nas duas tabelas. A
 *    elegibilidade (conselho da ÁREA, no MESMO tenant) é checada na aplicação
 *    contra o banco; o schema garante que a referência existe e não some depois.
 *
 * O rótulo do seat (`STUDENT_INTERN`) vive AQUI, no DTO — não há coluna de
 * `seatType` no banco: a existência da linha `intern_profile` já é o fato (ver
 * a nota do modelo no schema Prisma).
 */

/** Rótulo do seat, exposto na API. Ver nota acima sobre não haver coluna. */
export const internSeatTypeSchema = z
  .literal('STUDENT_INTERN')
  .describe('Tipo de seat — estagiário supervisionado (D-142).');

/**
 * Área de estágio (mirror do enum `InternArea` do Prisma — D-143). É o que
 * substitui "conselho próprio": o estagiário não tem registro, então declara a
 * ÁREA em que estuda, e a área determina quem pode supervisioná-lo.
 */
export const internAreaSchema = z
  .enum(['EDUCACAO_FISICA', 'NUTRICAO', 'MEDICINA'])
  .describe('Área de estágio — determina o conselho exigido do responsável (D-143).');

/**
 * **A regra de supervisão, em um lugar só** (D-143): qual conselho o responsável
 * precisa ter para supervisionar cada área.
 *
 * - `EDUCACAO_FISICA` → CREF (Educador Físico ou Personal Trainer)
 * - `NUTRICAO` → CRN (Nutricionista)
 * - `MEDICINA` → CRM (Médico)
 *
 * Mora no CONTRATO, e não no repositório, porque tem dois consumidores que
 * precisam concordar: o servidor (que recusa um supervisor fora da área) e a UI
 * (que só deve OFERECER supervisores da área). Duas cópias divergiriam, e a
 * divergência aqui significa oferecer na tela alguém que o POST recusa.
 *
 * **Não é a vertical do tenant que decide** — é o conselho do supervisor. Um
 * estagiário de educação física numa CLÍNICA é válido se a clínica tiver um
 * CREF no quadro; um de nutrição numa ACADEMIA, se ela tiver um CRN.
 */
export const SUPERVISOR_SPECIALTY_CODES_BY_AREA = {
  EDUCACAO_FISICA: ['TRAINING', 'PERSONAL_TRAINER'],
  NUTRICAO: ['NUTRITION'],
  MEDICINA: ['MEDICINE'],
} as const satisfies Record<z.infer<typeof internAreaSchema>, readonly string[]>;

// ---- Params / Request ----

export const internTenantParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant da empresa (clínica ou academia).'),
});

/**
 * A listagem de responsáveis elegíveis é SEMPRE por área — sem área a lista não
 * significa nada (quem supervisiona nutrição não supervisiona medicina). Por
 * isso a query é obrigatória, não opcional com fallback.
 */
export const internSupervisorQuerySchema = z.object({
  area: internAreaSchema,
});

/**
 * Fase A — a empresa pré-cadastra o estagiário. Campos mínimos: para onde vai o
 * convite, em que ÁREA ele estagia e, **obrigatoriamente**, quem é o
 * responsável. Sem profissão, sem conselho, sem especialidade: o estagiário não
 * tem nenhum dos três.
 *
 * O Zod garante que a área veio e é válida, e que o responsável foi indicado.
 * O que ele **não** alcança é se aquele responsável tem o conselho DAQUELA área
 * — isso é dado de outro registro, checado no service contra o banco (422).
 */
export const internCreateInviteSchema = z.object({
  email: z.string().email().describe('E-mail do estagiário convidado.'),
  area: internAreaSchema.describe(
    'Área de estágio — a empresa define; determina o conselho exigido do responsável.',
  ),
  name: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Nome informado pela empresa — facilita o convite; o civil vem no aceite.'),
  supervisorProfessionalProfileId: z
    .string()
    .min(1)
    .describe(
      'Responsável OBRIGATÓRIO: ProfessionalProfile do próprio tenant com o conselho da ÁREA ' +
        '(D-143). Sem ele não há convite — estagiário sem responsável é estado inválido.',
    ),
});

/**
 * Fase B — o estagiário aceita e completa a identidade. Mesmos campos de pessoa
 * do aceite de profissional (spec §4.4), MENOS conselho/especialidade e MAIS os
 * atributos de pessoa que a spec exige no aceite (nascimento, endereço,
 * WhatsApp — D-044). Aceita os termos (D-025): sem `acceptedTerms` a conta não
 * nasce; a gravação acontece **só** no ramo de conta nova.
 *
 * O responsável NÃO é reinformado aqui — vem do convite, como a especialidade
 * vem do convite no fluxo de profissional. O estagiário não escolhe quem o
 * supervisiona.
 */
export const internAcceptInviteSchema = z
  .object({
    token: z.string().min(1).describe('Token de uso único recebido no convite.'),
    password: strongPassword,
    name: z.string().min(1).describe('Nome civil do estagiário.'),
    socialName,
    gender: genderSchema.optional().describe('Gênero/identidade — opcional (spec §3.1).'),
    document: documentDigits,
    documentType: z.enum(['CPF', 'CNPJ']),
    whatsapp,
    birthDate,
    address: addressSchema,
    acceptedTerms,
  })
  // CPF-xor-CNPJ com dígito verificador REAL (D-043/spec §3) — mesma regra do
  // cadastro do autônomo, e literalmente a mesma peça (`document.ts`).
  .superRefine(cpfXorCnpjRefine);

// ---- Response ----

/**
 * Responsável ELEGÍVEL a supervisionar (D-142/D-143): profissional do próprio
 * tenant cujo conselho corresponde à ÁREA consultada (ver
 * `SUPERVISOR_SPECIALTY_CODES_BY_AREA`), com conselho preenchido. "Ativo" aqui é
 * **formato preenchido** (D-138) — a verificação de registro ativo de verdade
 * segue deferida (TODO(D-010)). Dado OPERACIONAL (D-015).
 */
export const internSupervisorViewSchema = z.object({
  professionalProfileId: z.string(),
  accountId: z.string(),
  displayName: z.string(),
  specialtyCode: specialtyCodeSchema,
  councilDocument: z.string(),
  councilState: brazilianStateSchema,
});

export const internSupervisorListResultSchema = z.object({
  supervisors: z.array(internSupervisorViewSchema),
});

export const internInviteViewSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  area: internAreaSchema,
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']),
  supervisorProfessionalProfileId: z.string(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const internCreateInviteResultSchema = z.object({
  invite: internInviteViewSchema,
  token: z.string(),
});

/**
 * Resultado do aceite. Devolve a ÁREA e o vínculo com o responsável junto do
 * seat: quem consome a API vê, na mesma resposta, em que área este seat atua,
 * que ele é supervisionado e por quem — a capacidade dele deriva daí (D-142).
 */
export const internAcceptInviteResultSchema = z.object({
  intern: z.object({
    accountId: z.string(),
    tenantId: z.string(),
    seatType: internSeatTypeSchema,
    area: internAreaSchema,
    supervisorProfessionalProfileId: z.string(),
  }),
  created: z.boolean(),
});

// ---- Tipos de wire ----
export type InternSeatType = z.infer<typeof internSeatTypeSchema>;
export type InternArea = z.infer<typeof internAreaSchema>;
export type InternSupervisorQuery = z.infer<typeof internSupervisorQuerySchema>;
export type InternTenantParams = z.infer<typeof internTenantParamsSchema>;
export type InternCreateInviteInput = z.infer<typeof internCreateInviteSchema>;
export type InternAcceptInviteInput = z.infer<typeof internAcceptInviteSchema>;
export type InternSupervisorView = z.infer<typeof internSupervisorViewSchema>;
export type InternSupervisorListResult = z.infer<typeof internSupervisorListResultSchema>;
export type InternInviteView = z.infer<typeof internInviteViewSchema>;
export type InternCreateInviteResult = z.infer<typeof internCreateInviteResultSchema>;
export type InternAcceptInviteResult = z.infer<typeof internAcceptInviteResultSchema>;

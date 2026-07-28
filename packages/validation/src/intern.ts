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
import { isValidCnpj, isValidCpf } from './document';
import { specialtyCodeSchema } from './specialty';

/**
 * Contrato do seat de ESTAGIÁRIO (D-142) — fonte única. Prefixo `intern*`
 * porque o barrel de `@fitvo/validation` é flat.
 *
 * O estagiário **NUNCA** é autocadastro (spec §1/§6): é estudante, não tem
 * conselho, e atuar sem supervisão é exercício ilegal da profissão (art. 47
 * DL 3.688/1941). Por isso o fluxo é o de convite em duas fases — o mesmo molde
 * do profissional de clínica (#102) —, com duas diferenças que são a regra
 * legal inteira:
 *
 * 1. **Não informa conselho** — nem no convite, nem no aceite. Não existe campo.
 * 2. **Responsável obrigatório** — `supervisorProfessionalProfileId` é
 *    obrigatório já no convite, e NOT NULL no banco nas duas tabelas. A
 *    elegibilidade do responsável (CREF ativo, do mesmo tenant) é checada na
 *    aplicação; o schema garante que a referência existe e não some depois.
 *
 * O rótulo do seat (`STUDENT_INTERN`) vive AQUI, no DTO — não há coluna de
 * `seatType` no banco: a existência da linha `intern_profile` já é o fato (ver
 * a nota do modelo no schema Prisma).
 */

/** Rótulo do seat, exposto na API. Ver nota acima sobre não haver coluna. */
export const internSeatTypeSchema = z
  .literal('STUDENT_INTERN')
  .describe('Tipo de seat — estagiário supervisionado (D-142).');

// ---- Params / Request ----

export const internTenantParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant da academia.'),
});

/**
 * Fase A — a academia pré-cadastra o estagiário. Campos mínimos: para onde vai o
 * convite e, **obrigatoriamente**, quem é o responsável. Sem profissão, sem
 * conselho, sem especialidade: o estagiário não tem nenhum dos três.
 */
export const internCreateInviteSchema = z.object({
  email: z.string().email().describe('E-mail do estagiário convidado.'),
  name: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Nome informado pela academia — facilita o convite; o civil vem no aceite.'),
  supervisorProfessionalProfileId: z
    .string()
    .min(1)
    .describe(
      'Responsável OBRIGATÓRIO: ProfessionalProfile de CREF do próprio tenant (D-142). ' +
        'Sem ele não há convite — estagiário sem responsável é estado inválido.',
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
    document: z
      .string()
      .regex(/^\d+$/, 'Documento deve conter apenas dígitos.')
      .describe('CPF ou CNPJ, só dígitos (D-043).'),
    documentType: z.enum(['CPF', 'CNPJ']),
    whatsapp,
    birthDate,
    address: addressSchema,
    acceptedTerms,
  })
  .superRefine((data, ctx) => {
    // CPF-xor-CNPJ com dígito verificador REAL (D-043/spec §3) — mesma regra do
    // cadastro do autônomo. O tipo declarado decide o algoritmo e o tamanho.
    const valid =
      data.documentType === 'CPF' ? isValidCpf(data.document) : isValidCnpj(data.document);
    if (!valid) {
      ctx.addIssue({
        code: 'custom',
        path: ['document'],
        message:
          data.documentType === 'CPF'
            ? 'CPF inválido (11 dígitos + dígito verificador).'
            : 'CNPJ inválido (14 dígitos + dígito verificador).',
      });
    }
  });

// ---- Response ----

/**
 * Responsável ELEGÍVEL a supervisionar (D-142): profissional de CREF
 * (TRAINING/PERSONAL_TRAINER) do próprio tenant, com conselho preenchido.
 * "Ativo" aqui é **formato preenchido** (D-138) — a verificação de registro
 * ativo de verdade segue deferida (TODO(D-010)). Dado OPERACIONAL (D-015).
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
 * Resultado do aceite. Devolve o vínculo com o responsável junto do seat: quem
 * consome a API vê, na mesma resposta, que este seat é supervisionado e por
 * quem — a capacidade dele deriva daí (D-142).
 */
export const internAcceptInviteResultSchema = z.object({
  intern: z.object({
    accountId: z.string(),
    tenantId: z.string(),
    seatType: internSeatTypeSchema,
    supervisorProfessionalProfileId: z.string(),
  }),
  created: z.boolean(),
});

// ---- Tipos de wire ----
export type InternSeatType = z.infer<typeof internSeatTypeSchema>;
export type InternTenantParams = z.infer<typeof internTenantParamsSchema>;
export type InternCreateInviteInput = z.infer<typeof internCreateInviteSchema>;
export type InternAcceptInviteInput = z.infer<typeof internAcceptInviteSchema>;
export type InternSupervisorView = z.infer<typeof internSupervisorViewSchema>;
export type InternSupervisorListResult = z.infer<typeof internSupervisorListResultSchema>;
export type InternInviteView = z.infer<typeof internInviteViewSchema>;
export type InternCreateInviteResult = z.infer<typeof internCreateInviteResultSchema>;
export type InternAcceptInviteResult = z.infer<typeof internAcceptInviteResultSchema>;

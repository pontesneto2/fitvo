import { z } from 'zod';

import { acceptedTerms, brazilianStateSchema, councilDocument } from './auth';
import {
  companyAdminRoleSchema,
  companyRegistrationRefine,
  companyRegistrationShape,
  medicalSpecialtySchema,
} from './company-registration';
import { cpfXorCnpjRefine, documentDigits } from './document';
import { type SpecialtyCode, specialtyCodeSchema } from './specialty';

/**
 * Contrato da clínica (D-014/D-048/D-032) — fonte única. Nomes prefixados com
 * `clinic` porque o barrel de `@fitvo/validation` é flat e `tenantParams`/
 * `invite*` colidiriam com o slice de paciente. O service já entrega timestamps
 * como ISO string (sem ponte Date→ISO aqui).
 *
 * O cadastro PÚBLICO da empresa (`registerClinicSchema`) é montado sobre a base
 * compartilhada de `company-registration.ts` — clínica e academia têm o MESMO
 * cadastro (spec §4.2/§4.3) e diferem só na vertical. Ver `academy.ts`.
 */

// Reexportados: nasceram no contrato de clínica, hoje são compartilhados com a
// academia e vivem na base comum. Mantidos aqui para não quebrar o import de
// quem já os consome por este módulo.
export { companyAdminRoleSchema, medicalSpecialtySchema };

// ---- Params / Request ----
export const clinicTenantParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant da clinica.'),
});

export const clinicInviteParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant da clinica.'),
  inviteId: z.string().min(1).describe('ID do convite.'),
});

/**
 * Convite admin→profissional de clínica. A CLÍNICA define no convite a profissão
 * (SpecialtyCode) + o conselho (councilDocument/UF, formato — D-138) + a
 * especialidade médica quando for o caso — o profissional NÃO reinforma nada
 * disso no aceite. O aceite lê tudo do convite (ADR-0015/D-137/D-138).
 *
 * Regra cross-field (`.superRefine` — primeiro refine do projeto): `medicalSpecialty`
 * é OBRIGATÓRIA sse `specialtyCode === 'MEDICINE'` e PROIBIDA caso contrário.
 * Estado inválido irrepresentável no request: médico sem especialidade médica,
 * ou não-médico com especialidade médica, o Zod rejeita com 400 antes de tocar
 * o banco.
 */
export const clinicCreateInviteSchema = z
  .object({
    email: z.string().email().describe('E-mail do profissional convidado.'),
    specialtyCode: specialtyCodeSchema.describe('Profissão/especialidade do convite (D-137).'),
    councilDocument,
    councilState: brazilianStateSchema.describe('UF do conselho profissional (D-126).'),
    medicalSpecialty: medicalSpecialtySchema
      .optional()
      .describe('Especialidade médica — obrigatória sse MEDICINE, proibida caso contrário.'),
  })
  .superRefine((data, ctx) => {
    if (data.specialtyCode === 'MEDICINE' && data.medicalSpecialty === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['medicalSpecialty'],
        message: 'Especialidade médica é obrigatória para convite de MEDICINE.',
      });
    }
    if (data.specialtyCode !== 'MEDICINE' && data.medicalSpecialty !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['medicalSpecialty'],
        message: 'Especialidade médica só é permitida para convite de MEDICINE.',
      });
    }
  });

/**
 * Aceite do convite. O profissional só completa a identidade (senha/nome/CPF) e
 * ACEITA os termos (D-025 — LGPD): sem `acceptedTerms` a conta não nasce. NÃO
 * reinforma especialidade/conselho — esses vêm do convite. Reusa o `acceptedTerms`
 * de auth (literal(true)×2) — mesmo gate irrepresentável do cadastro.
 */
export const clinicAcceptInviteSchema = z
  .object({
    token: z.string().min(1).describe('Token de uso unico recebido no convite.'),
    password: z.string().min(8).describe('Senha em claro (mín. 8).'),
    name: z.string().min(1),
    document: documentDigits,
    documentType: z.enum(['CPF', 'CNPJ']),
    acceptedTerms,
  })
  // CPF-xor-CNPJ com dígito verificador REAL (D-043/spec §3). Até aqui este
  // aceite validava o documento SÓ por comprimento (`min(11).max(18)`) — uma
  // porta de nascimento de conta por onde entrava CPF com DV inválido,
  // enquanto autônomo/estagiário/empresa já exigiam o DV. Mesma peça
  // compartilhada dos demais fluxos, em `document.ts`.
  .superRefine(cpfXorCnpjRefine);

/**
 * Cadastro PÚBLICO de CLÍNICA (spec §1/§2/§4.2 · ADR-0015/D-139) — nasce
 * `Tenant(CLINIC)` + `Account`(admin) + membership `CLINIC_ADMIN` (+ perfil
 * profissional se "também atende"). Área crítica (LGPD + cria tenant + vínculo).
 *
 * Campos e regras cross-field vêm INTEIROS da base de empresa
 * (`company-registration.ts`) — clínica e academia são o mesmo cadastro (spec
 * §4.2/§4.3). O que a clínica define é só a VERTICAL: comporta o catálogo
 * inteiro de profissões, medicina inclusive (e portanto a especialidade médica).
 */
export const CLINIC_SPECIALTY_CODES: readonly SpecialtyCode[] = [
  'MEDICINE',
  'NUTRITION',
  'TRAINING',
  'PERSONAL_TRAINER',
];

export const registerClinicSchema = z.object(companyRegistrationShape).superRefine(
  companyRegistrationRefine({
    allowedSpecialtyCodes: CLINIC_SPECIALTY_CODES,
    specialtyOutOfVerticalMessage: 'Profissão fora do catálogo da clínica.',
  }),
);

// ---- Response ----
export const clinicInviteViewSchema = z.object({
  id: z.string(),
  email: z.string(),
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const clinicProfessionalViewSchema = z.object({
  accountId: z.string(),
  professionalProfileId: z.string(),
  name: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  joinedAt: z.iso.datetime(),
});

export const clinicCreateInviteResultSchema = z.object({
  invite: clinicInviteViewSchema,
  token: z.string(),
});

export const clinicRosterResultSchema = z.object({
  professionals: z.array(clinicProfessionalViewSchema),
  pendingInvites: z.array(clinicInviteViewSchema),
});

export const clinicAcceptInviteResultSchema = z.object({
  professional: z.object({ accountId: z.string(), tenantId: z.string() }),
  created: z.boolean(),
});

// ---- Tipos de wire ----
export type MedicalSpecialty = z.infer<typeof medicalSpecialtySchema>;
export type ClinicTenantParams = z.infer<typeof clinicTenantParamsSchema>;
export type ClinicInviteParams = z.infer<typeof clinicInviteParamsSchema>;
export type ClinicCreateInviteInput = z.infer<typeof clinicCreateInviteSchema>;
export type ClinicAcceptInviteInput = z.infer<typeof clinicAcceptInviteSchema>;
export type ClinicAdminRole = z.infer<typeof companyAdminRoleSchema>;
export type RegisterClinicInput = z.infer<typeof registerClinicSchema>;
export type ClinicInviteView = z.infer<typeof clinicInviteViewSchema>;
export type ClinicProfessionalView = z.infer<typeof clinicProfessionalViewSchema>;
export type ClinicCreateInviteResult = z.infer<typeof clinicCreateInviteResultSchema>;
export type ClinicRosterResult = z.infer<typeof clinicRosterResultSchema>;
export type ClinicAcceptInviteResult = z.infer<typeof clinicAcceptInviteResultSchema>;

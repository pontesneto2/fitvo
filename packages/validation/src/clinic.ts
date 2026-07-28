import { z } from 'zod';

import {
  acceptedTerms,
  addressSchema,
  birthDate,
  brazilianStateSchema,
  councilDocument,
  genderSchema,
  socialName,
  strongPassword,
  whatsapp,
} from './auth';
import { isValidCnpj, isValidCpf } from './document';
import { specialtyCodeSchema } from './specialty';

/**
 * Contrato da clínica (D-014/D-048/D-032) — fonte única. Nomes prefixados com
 * `clinic` porque o barrel de `@fitvo/validation` é flat e `tenantParams`/
 * `invite*` colidiriam com o slice de paciente. O service já entrega timestamps
 * como ISO string (sem ponte Date→ISO aqui).
 */

/**
 * Especialidade MÉDICA (mirror do enum `MedicalSpecialty` do Prisma). Escopo
 * DELIBERADAMENTE mínimo — só as duas especialidades médicas que o produto
 * atende hoje. NÃO reusa `rqe` (aquele é o registro genérico do CRM); esta é a
 * qualificação de especialista dentro da Medicina, e é uma coluna própria em
 * `ProfessionalSpecialty`. A regra "só quando MEDICINE" é do `.superRefine`
 * abaixo (e da aplicação), nunca da coluna (nulável no banco).
 */
export const medicalSpecialtySchema = z
  .enum(['NUTROLOGIA', 'ENDOCRINOLOGIA'])
  .describe('Especialidade médica (apenas Nutrologia/Endocrinologia).');

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
export const clinicAcceptInviteSchema = z.object({
  token: z.string().min(1).describe('Token de uso unico recebido no convite.'),
  password: z.string().min(8).describe('Senha em claro (mín. 8).'),
  name: z.string().min(1),
  document: z.string().min(11).max(18).describe('CPF ou CNPJ do profissional (D-043).'),
  documentType: z.enum(['CPF', 'CNPJ']),
  acceptedTerms,
});

/**
 * "Você é?" no cadastro público da empresa (spec §2/§4.2) — REQUEST-ONLY, não é
 * enum de banco: a membership do admin é sempre `CLINIC_ADMIN`; "também atende"
 * NÃO é uma role nova, é a PRESENÇA de um `ProfessionalProfile`+
 * `ProfessionalSpecialty` para a mesma conta. Gestor-puro nunca informa conselho;
 * quem atende sempre informa (regra ampla e segura — spec §2).
 */
export const clinicAdminRoleSchema = z
  .enum(['MANAGER_ONLY', 'MANAGER_PROVIDER'])
  .describe('"Você é?" — só gestor (MANAGER_ONLY) ou gestor que também atende (MANAGER_PROVIDER).');

/**
 * Cadastro PÚBLICO de CLÍNICA (spec §1/§2/§4.2 · ADR-0015/D-139) — nasce
 * `Tenant(CLINIC)` + `Account`(admin) + membership `CLINIC_ADMIN` (+ perfil
 * profissional se "também atende"). Área crítica (LGPD + cria tenant + vínculo).
 *
 * Empresa: **só CNPJ** (spec §2) com DV real. `tradeName` (nome fantasia) vira
 * `tenant.name` (exibição, como o SOLO usa o nome da pessoa); `legalName` (razão
 * social) é o dado fiscal (coluna própria). Admin: pessoa física com CPF
 * obrigatório (DV real) — a empresa é CNPJ, o gestor-pessoa é CPF.
 *
 * `.superRefine` cobre três regras cross-field: (1) DV do CNPJ da empresa e do
 * CPF do admin; (2) conselho obrigatório sse `MANAGER_PROVIDER` e proibido em
 * `MANAGER_ONLY` (gestor-puro não tem conselho — spec §2); (3) especialidade
 * médica obrigatória sse Médico e proibida nas demais (mesma regra do convite
 * #102). Estados inválidos irrepresentáveis: gestor-puro com conselho, ou
 * gestor-que-atende sem conselho, o Zod rejeita com 400 antes de tocar o banco.
 *
 * OUT (spec §4.2, itens 7-8, deferidos): "Nº de profissionais previsto" cortado
 * (dado comercial sem uso funcional no MVP). "Especialidades oferecidas" NÃO é
 * campo manual — quando implementado, DERIVA das especialidades dos
 * profissionais do tenant (a clínica oferece o que seus profissionais fazem);
 * nunca virar multi-select. TODO(onboarding): derivar de ProfessionalSpecialty.
 */
export const registerClinicSchema = z
  .object({
    // --- Empresa (CNPJ obrigatório — spec §2) ---
    legalName: z.string().trim().min(1).describe('Razão social — dado fiscal (tenant.legalName).'),
    tradeName: z
      .string()
      .trim()
      .min(1)
      .describe('Nome fantasia — vira tenant.name (nome de exibição).'),
    cnpj: z
      .string()
      .regex(/^\d+$/, 'CNPJ deve conter apenas dígitos.')
      .describe('CNPJ da empresa — só dígitos + DV real (spec §2).'),
    companyEmail: z.string().email().describe('E-mail da empresa.'),
    companyPhone: z
      .string()
      .regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos, só números.')
      .describe('Telefone/WhatsApp da empresa — 10 ou 11 dígitos, só números.'),
    address: addressSchema.describe('Endereço do estabelecimento (da empresa, não pessoal).'),
    // --- Admin (pessoa física — CPF obrigatório, D1) ---
    role: clinicAdminRoleSchema,
    name: z.string().min(1).describe('Nome civil do admin.'),
    socialName,
    document: z
      .string()
      .regex(/^\d+$/, 'Documento deve conter apenas dígitos.')
      .describe('CPF do admin (pessoa física) — só dígitos + DV real.'),
    email: z.string().email().describe('E-mail de login do admin (único).'),
    password: strongPassword,
    whatsapp,
    birthDate,
    gender: genderSchema.optional().describe('Gênero/identidade do admin — opcional (spec §3.1).'),
    // --- Condicional: só quando MANAGER_PROVIDER (abre com "também atende") ---
    specialtyCode: specialtyCodeSchema
      .optional()
      .describe('Profissão de quem atende — obrigatória sse "também atende".'),
    councilDocument: councilDocument.optional(),
    councilState: brazilianStateSchema
      .optional()
      .describe('UF do conselho — obrigatória sse "também atende".'),
    medicalSpecialty: medicalSpecialtySchema
      .optional()
      .describe('Especialidade médica — obrigatória sse Médico que também atende.'),
    acceptedTerms,
  })
  .superRefine((data, ctx) => {
    // (1) Dígito verificador REAL. Empresa é SÓ CNPJ; admin-pessoa é SÓ CPF.
    if (!isValidCnpj(data.cnpj)) {
      ctx.addIssue({ code: 'custom', path: ['cnpj'], message: 'CNPJ inválido (14 dígitos + DV).' });
    }
    if (!isValidCpf(data.document)) {
      ctx.addIssue({
        code: 'custom',
        path: ['document'],
        message: 'CPF do gestor inválido (11 dígitos + DV).',
      });
    }

    // (2)+(3) Conselho condicional ao "Você é?" + regra da especialidade médica.
    if (data.role === 'MANAGER_PROVIDER') {
      if (data.specialtyCode === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['specialtyCode'],
          message: 'Informe a profissão de quem também atende.',
        });
      }
      if (data.councilDocument === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['councilDocument'],
          message: 'Conselho é obrigatório para quem também atende.',
        });
      }
      if (data.councilState === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['councilState'],
          message: 'UF do conselho é obrigatória para quem também atende.',
        });
      }
      if (data.specialtyCode === 'MEDICINE' && data.medicalSpecialty === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['medicalSpecialty'],
          message: 'Especialidade médica é obrigatória para Médico.',
        });
      }
      if (
        data.specialtyCode !== undefined &&
        data.specialtyCode !== 'MEDICINE' &&
        data.medicalSpecialty !== undefined
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['medicalSpecialty'],
          message: 'Especialidade médica só é permitida para Médico.',
        });
      }
    } else {
      // MANAGER_ONLY (gestor-puro): conselho/especialidade PROIBIDOS (spec §2).
      if (data.specialtyCode !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['specialtyCode'],
          message: 'Gestor-puro não informa profissão.',
        });
      }
      if (data.councilDocument !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['councilDocument'],
          message: 'Gestor-puro não informa conselho.',
        });
      }
      if (data.councilState !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['councilState'],
          message: 'Gestor-puro não informa UF de conselho.',
        });
      }
      if (data.medicalSpecialty !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['medicalSpecialty'],
          message: 'Gestor-puro não informa especialidade médica.',
        });
      }
    }
  });

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
export type ClinicAdminRole = z.infer<typeof clinicAdminRoleSchema>;
export type RegisterClinicInput = z.infer<typeof registerClinicSchema>;
export type ClinicInviteView = z.infer<typeof clinicInviteViewSchema>;
export type ClinicProfessionalView = z.infer<typeof clinicProfessionalViewSchema>;
export type ClinicCreateInviteResult = z.infer<typeof clinicCreateInviteResultSchema>;
export type ClinicRosterResult = z.infer<typeof clinicRosterResultSchema>;
export type ClinicAcceptInviteResult = z.infer<typeof clinicAcceptInviteResultSchema>;

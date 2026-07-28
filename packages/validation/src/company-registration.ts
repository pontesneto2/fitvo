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
import { type SpecialtyCode, specialtyCodeSchema } from './specialty';

/**
 * Cadastro público de EMPRESA — a base COMPARTILHADA de clínica (D-139) e
 * academia (D-141). A spec (§4.2/§4.3) diz textualmente que os dois cadastros
 * são IDÊNTICOS: mesma empresa (só CNPJ), mesmo admin pessoa física, mesmo
 * "Você é?". Diferem só na VERTICAL — quais profissões o tenant comporta.
 *
 * Por isso o schema não é duplicado por vertical: o SHAPE mora aqui uma vez e
 * cada vertical fornece suas `CompanyVerticalRules` ao `.superRefine`. Uma regra
 * nova de cadastro de empresa entra num lugar só e vale para as duas.
 *
 * Este módulo é INTERNO ao pacote (não exportado no barrel): os consumidores
 * usam `registerClinicSchema` / `registerAcademySchema`, que são os contratos de
 * fato. O que é público e compartilhado (`companyAdminRoleSchema`,
 * `medicalSpecialtySchema`) é reexportado pelos módulos de vertical.
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

/**
 * "Você é?" no cadastro público da empresa (spec §2/§4.2) — REQUEST-ONLY, não é
 * enum de banco: a membership do admin é sempre `CLINIC_ADMIN`; "também atende"
 * NÃO é uma role nova, é a PRESENÇA de um `ProfessionalProfile`+
 * `ProfessionalSpecialty` para a mesma conta. Gestor-puro nunca informa conselho;
 * quem atende sempre informa (regra ampla e segura — spec §2). Vale igual para
 * clínica e academia (o gestor de academia é "gestor/professor").
 */
export const companyAdminRoleSchema = z
  .enum(['MANAGER_ONLY', 'MANAGER_PROVIDER'])
  .describe('"Você é?" — só gestor (MANAGER_ONLY) ou gestor que também atende (MANAGER_PROVIDER).');

/**
 * O que distingue uma vertical da outra no CADASTRO. Só isto — o resto do
 * formulário é idêntico (spec §4.2/§4.3).
 */
export interface CompanyVerticalRules {
  /**
   * Profissões que a vertical comporta. Clínica: todas. Academia: SÓ CREF
   * (Educador Físico / Personal Trainer) — médico e nutricionista são
   * PROIBIDOS na academia (D-141), não é o tipo de estabelecimento deles.
   */
  allowedSpecialtyCodes: readonly SpecialtyCode[];
  /**
   * Mensagem de erro quando a profissão está fora da vertical. Explícita por
   * vertical porque "profissão inválida" não ajuda quem preenche o formulário.
   */
  specialtyOutOfVerticalMessage: string;
}

/**
 * Campos do cadastro público de empresa. Empresa: **só CNPJ** (spec §2) com DV
 * real. `tradeName` (nome fantasia) vira `tenant.name` (exibição, como o SOLO usa
 * o nome da pessoa); `legalName` (razão social) é o dado fiscal (coluna própria).
 * Admin: pessoa física com CPF obrigatório (DV real) — a empresa é CNPJ, o
 * gestor-pessoa é CPF.
 *
 * `specialtyCode` aceita o catálogo INTEIRO aqui e é estreitado por vertical no
 * refine: assim uma profissão fora da vertical vira uma mensagem que explica o
 * porquê, em vez do erro opaco de enum.
 *
 * OUT (spec §4.2, itens 7-8, deferidos): "Nº de profissionais previsto" cortado
 * (dado comercial sem uso funcional no MVP). "Especialidades oferecidas" NÃO é
 * campo manual — quando implementado, DERIVA das especialidades dos
 * profissionais do tenant (a empresa oferece o que seus profissionais fazem);
 * nunca virar multi-select. TODO(onboarding): derivar de ProfessionalSpecialty.
 */
export const companyRegistrationShape = {
  // --- Empresa (CNPJ obrigatório — spec §2) ---
  legalName: z.string().trim().min(1).describe('Razão social — dado fiscal (tenant.legalName).'),
  tradeName: z.string().trim().min(1).describe('Nome fantasia — vira tenant.name (exibição).'),
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
  // --- Admin (pessoa física — CPF obrigatório) ---
  role: companyAdminRoleSchema,
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
} as const;

/** Formato do objeto já validado pelo shape — entrada do refine. */
type CompanyRegistration = z.infer<z.ZodObject<typeof companyRegistrationShape>>;

/**
 * Regras cross-field do cadastro de empresa, parametrizadas pela vertical:
 *
 * 1. **DV real** do CNPJ da empresa e do CPF do admin.
 * 2. **Conselho condicional ao "Você é?"** — obrigatório sse `MANAGER_PROVIDER`,
 *    PROIBIDO em `MANAGER_ONLY` (gestor-puro não tem conselho — spec §2).
 * 3. **Profissão dentro da vertical** — academia só comporta CREF (D-141).
 * 4. **Especialidade médica** obrigatória sse Médico, proibida nas demais. Numa
 *    vertical sem medicina a regra se resolve sozinha por (3): sem Médico
 *    permitido, `medicalSpecialty` nunca é obrigatória e sempre cai no ramo
 *    "proibida" — não precisa de um flag separado que pudesse divergir.
 *
 * Estados inválidos irrepresentáveis no request: gestor-puro com conselho,
 * gestor-que-atende sem conselho, médico numa academia — o Zod rejeita com 400
 * antes de tocar o banco.
 */
export function companyRegistrationRefine(
  rules: CompanyVerticalRules,
): (data: CompanyRegistration, ctx: z.RefinementCtx) => void {
  return (data, ctx) => {
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

    if (data.role === 'MANAGER_PROVIDER') {
      // (2) Quem atende SEMPRE informa profissão + conselho + UF.
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
      // (3) A profissão precisa caber na vertical do estabelecimento.
      if (
        data.specialtyCode !== undefined &&
        !rules.allowedSpecialtyCodes.includes(data.specialtyCode)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['specialtyCode'],
          message: rules.specialtyOutOfVerticalMessage,
        });
      }
      // (4) Especialidade médica: obrigatória sse Médico, proibida nas demais.
      if (
        data.specialtyCode === 'MEDICINE' &&
        rules.allowedSpecialtyCodes.includes('MEDICINE') &&
        data.medicalSpecialty === undefined
      ) {
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
      // Vertical sem medicina: `medicalSpecialty` não tem dono possível.
      if (
        data.specialtyCode === 'MEDICINE' &&
        !rules.allowedSpecialtyCodes.includes('MEDICINE') &&
        data.medicalSpecialty !== undefined
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['medicalSpecialty'],
          message: rules.specialtyOutOfVerticalMessage,
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
  };
}

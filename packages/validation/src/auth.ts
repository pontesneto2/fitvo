import { z } from 'zod';

import { isValidCnpj, isValidCpf } from './document';

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
 * Gate MÍNIMO de força de senha no CADASTRO — servidor, não só UI. Além dos 8
 * caracteres, exige ao menos 1 letra e ao menos 1 dígito. NÃO exige
 * maiúscula/símbolo (fricção sem ganho real de segurança): o medidor visual do
 * front incentiva mais, mas o gate obrigatório para a conta nascer é este. O
 * `password` simples (min 8) segue valendo para login/recuperação, que não são
 * momento de cadastro.
 */
export const strongPassword = z
  .string()
  .min(8, 'A senha precisa ter no mínimo 8 caracteres.')
  .regex(/[A-Za-z]/, 'A senha precisa ter ao menos uma letra.')
  .regex(/\d/, 'A senha precisa ter ao menos um número.')
  .describe('Senha em claro — mín. 8, ao menos 1 letra e 1 número.');

/**
 * Nome social (Decreto 8.727/2016 — spec §3.1) — OPCIONAL em todo form de
 * pessoa. Se vier, não pode ser vazio. Compartilhado entre os cadastros
 * (autônomo, admin de clínica…) — a regra de exibição `displayName` é derivada
 * no servidor (ver CLAUDE.md / deriveDisplayName).
 */
export const socialName = z
  .string()
  .trim()
  .min(1)
  .optional()
  .describe('Nome social (exibido no lugar do civil quando preenchido) — spec §3.1.');

/**
 * WhatsApp da PESSOA — SÓ dígitos no fio (DDD + celular = 11 dígitos). A máscara
 * `(00) 00000-0000` é responsabilidade da UI; o contrato armazena o número
 * normalizado. Não-dígito (máscara) é rejeitado com 400, garantindo storage
 * limpo sem depender de transform (que não é representável no OpenAPI — D-032).
 */
export const whatsapp = z
  .string()
  .regex(/^\d{11}$/, 'WhatsApp deve ter 11 dígitos (DDD + celular), só números.')
  .describe('WhatsApp — 11 dígitos (DDD + celular), só números (máscara é UI).');

/**
 * Data de nascimento (D-044) — data de CALENDÁRIO `YYYY-MM-DD` no fio, e o
 * cadastro exige MAIORIDADE (18+). A idade é DERIVADA de hoje, nunca
 * armazenada (mesma disciplina do IMC — D-132). @db.Date no banco: sem hora,
 * sem fuso (ninguém nasce "às 00h UTC" — evita o deslize do ADR-0012).
 */
export const birthDate = z.iso
  .date()
  .refine(isAtLeastEighteen, { message: 'É preciso ter 18 anos ou mais para se cadastrar.' })
  .describe('Data de nascimento (YYYY-MM-DD) — maioridade obrigatória (D-044).');

/** ≥ 18 anos completos na data de hoje (UTC). Aniversário no dia conta como completado. */
function isAtLeastEighteen(isoDate: string): boolean {
  const dob = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) {
    return false;
  }
  const eighteenth = new Date(
    Date.UTC(dob.getUTCFullYear() + 18, dob.getUTCMonth(), dob.getUTCDate()),
  );
  return eighteenth.getTime() <= Date.now();
}

/** UF (mirror do enum `BrazilianState` do Prisma) — usada pelo conselho profissional (D-126). */
export const brazilianStateSchema = z.enum([
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
]);

/**
 * Gênero / identidade (spec §3.1 — dado sensível LGPD). Enum INCLUSIVO,
 * OPCIONAL em todos os cadastros. NÃO se confunde com sexo biológico
 * (`biologicalSex`, exclusivo do paciente): respeito à identidade ≠ variável de
 * cálculo clínico — por isso são campos distintos. Mirror do enum `Gender` do
 * Prisma.
 */
export const genderSchema = z.enum([
  'MULHER_CIS',
  'HOMEM_CIS',
  'MULHER_TRANS',
  'HOMEM_TRANS',
  'NAO_BINARIO',
  'OUTRO',
  'PREFIRO_NAO_INFORMAR',
]);

/**
 * Endereço da PESSOA (D-044) — bloco. CEP só dígitos (8), como o WhatsApp:
 * máscara é UI, storage é normalizado. `complemento` opcional; `country` default
 * 'BR' (lançamento pt-BR). `state` reusa o enum de UF. Todos os campos textuais
 * exigidos são não-vazios; o preenchimento pode vir do ViaCEP mas o gate é do
 * servidor.
 */
export const addressSchema = z
  .object({
    cep: z
      .string()
      .regex(/^\d{8}$/, 'CEP deve ter 8 dígitos, só números.')
      .describe('CEP — 8 dígitos, só números (máscara é UI).'),
    logradouro: z.string().trim().min(1, 'Informe o logradouro.'),
    numero: z.string().trim().min(1, 'Informe o número.'),
    complemento: z.string().trim().optional(),
    bairro: z.string().trim().min(1, 'Informe o bairro.'),
    cidade: z.string().trim().min(1, 'Informe a cidade.'),
    state: brazilianStateSchema.describe('UF do endereço.'),
    country: z.string().trim().default('BR').describe('País do endereço (default BR).'),
  })
  .describe('Endereço da pessoa (D-044).');

/**
 * Registro no conselho profissional (CREF/CRN/CRM) — validado apenas em
 * FORMATO (D-138): presença + tamanho razoável + caracteres esperados de um
 * registro (dígitos/letras/`-`/`/`). NÃO valida atividade/validade real do
 * registro — isso é TODO(D-010), trabalho futuro. "Obrigatório preencher" ≠
 * "verificado" é palavra de força do ADR-0015 (D-138): não apertar esta regex
 * para simular uma verificação que não existe.
 */
export const councilDocument = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9/-]+$/, 'Formato de registro no conselho invalido.')
  .describe('Registro no conselho (CREF/CRN/CRM) — validado so em formato (D-138).');

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

export const registerProfessionalSchema = z
  .object({
    email,
    password: strongPassword,
    name: z.string().min(1).describe('Nome civil — deriva tenant.name e uso fiscal/documento.'),
    socialName,
    /** Gênero/identidade — OPCIONAL (dado sensível, spec §3.1). */
    gender: genderSchema.optional().describe('Gênero/identidade — opcional (spec §3.1).'),
    /**
     * CPF ou CNPJ da PESSOA (D-043) — SÓ dígitos no fio (máscara é UI). O tipo
     * decide o tamanho e o dígito verificador (regra cross-field no
     * `.superRefine` abaixo): CPF ⇒ 11 díg + DV; CNPJ ⇒ 14 díg + DV. Aqui só a
     * disciplina de "apenas dígitos"; a validade real do DV é o refine.
     */
    document: z
      .string()
      .regex(/^\d+$/, 'Documento deve conter apenas dígitos.')
      .describe('CPF ou CNPJ, só dígitos (D-043).'),
    documentType: z.enum(['CPF', 'CNPJ']),
    whatsapp,
    birthDate,
    address: addressSchema,
    /**
     * Especialidade reivindicada no signup (D-137 — ADR-0015): o autônomo
     * escolhe UMA especialidade no cadastro; as demais entram por fluxo
     * proprio, fora deste contrato.
     */
    specialtyId: z.string().min(1).describe('Especialidade reivindicada no signup (D-137).'),
    councilDocument,
    councilState: brazilianStateSchema.describe('UF do conselho profissional (D-126).'),
    acceptedTerms,
  })
  .superRefine((data, ctx) => {
    // CPF-xor-CNPJ com dígito verificador REAL (D-043). O tipo declarado
    // determina qual algoritmo e qual tamanho valem — um número bem formado do
    // tipo errado (CPF com 14 díg, CNPJ com 11) ou com DV inválido é 400 antes
    // de qualquer escrita. "Bem formado" ≠ "existe na Receita" — só o DV.
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
  name: z.string().describe('Nome civil — uso fiscal/documento; NÃO exibir quando há nome social.'),
  /**
   * Nome de EXIBIÇÃO (spec §3.1) — `socialName ?? name`, derivado no servidor.
   * Fonte única: web/mobile/admin apenas consomem, para nunca vazar o nome
   * civil de quem pediu nome social.
   */
  displayName: z.string().describe('Nome de exibição (socialName ?? name) — spec §3.1.'),
});

export const authResultSchema = z.object({
  account: accountSummarySchema,
  tokens: tokensSchema,
});

export const refreshResultSchema = z.object({ tokens: tokensSchema });

export const meResultSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().describe('Nome civil — uso fiscal/documento; NÃO exibir quando há nome social.'),
  /** Nome de EXIBIÇÃO (socialName ?? name) — derivado no servidor (spec §3.1). */
  displayName: z.string().describe('Nome de exibição (socialName ?? name) — spec §3.1.'),
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

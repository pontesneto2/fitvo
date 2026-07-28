import { isValidCnpj, isValidCpf } from '@fitvo/validation';
import { z } from 'zod';

import { isAtLeastEighteen, onlyDigits } from './masks';

/**
 * DTOs de auth do cliente web. LOCAIS de proposito: `@fitvo/contracts` ainda esta
 * vazio (esqueleto) — divida registrada no roadmap para mover estes tipos para la.
 * Espelham o contrato real da API (`apps/api/.../auth-schemas.ts` e `AuthResult`/
 * `MeResult` do auth-application-service).
 */
export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  // ISO string quando serializado pela API (Fastify serializa Date -> ISO).
  readonly accessExpiresAt?: string;
  readonly refreshExpiresAt?: string;
}

export interface Account {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export interface LoginResult {
  readonly account: Account;
  readonly tokens: AuthTokens;
}

/** Resposta de GET /v1/auth/me (MeResult). */
export interface Me {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
}

/** Espelha o `loginSchema` da API. Mensagens em pt-BR para o formulario. */
export const loginInputSchema = z.object({
  email: z.string().email('Informe um e-mail valido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * Espelha `acceptedTerms` de `registerProfessionalSchema`/`patientAcceptInviteSchema`
 * (D-025 — LGPD). Cada campo exige o literal `true`: uma caixa desmarcada vira
 * `false` no form state, o Zod rejeita e a UI mostra o erro — nunca chega a
 * criar a conta sem os dois aceites.
 */
const acceptedTermsInput = z.object({
  termsOfUse: z.boolean().refine((v) => v, { message: 'E preciso aceitar os Termos de Uso.' }),
  privacyPolicy: z
    .boolean()
    .refine((v) => v, { message: 'E preciso aceitar a Politica de Privacidade.' }),
});

const registerEmail = z.string().email('Informe um e-mail valido.');
const registerPassword = z.string().min(8, 'A senha precisa ter no minimo 8 caracteres.');
const registerName = z.string().min(1, 'Informe o nome completo.');
const cpf = z.string().min(11, 'Informe um CPF valido.').max(14, 'Informe um CPF valido.');

/**
 * Gate MÍNIMO de força de senha no cadastro — espelha `strongPassword` da API
 * (min 8 + 1 letra + 1 número). O medidor visual incentiva mais (maiúscula/
 * símbolo), mas o gate obrigatório é este. Maiúscula/símbolo NÃO são exigidos
 * (evita fricção e senha pior).
 */
const strongRegisterPassword = z
  .string()
  .min(8, 'A senha precisa ter no minimo 8 caracteres.')
  .regex(/[A-Za-z]/, 'A senha precisa ter ao menos uma letra.')
  .regex(/\d/, 'A senha precisa ter ao menos um numero.');

/** Mirror das 27 UFs (mesmo enum `BrazilianState` do Prisma) — conselho profissional (D-126). */
export const BRAZILIAN_STATES = [
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
] as const;

const brazilianStateInput = z.enum(BRAZILIAN_STATES, { message: 'Selecione a UF do conselho.' });

/**
 * Espelha o `councilDocument` de `registerProfessionalSchema` da API —
 * validacao GENERICA de formato (D-138), sem regex por CREF/CRN/CRM (decisao
 * de produto ainda nao registrada).
 */
const councilDocumentInput = z
  .string()
  .trim()
  .min(1, 'Informe o registro no conselho.')
  .max(20, 'Registro invalido.')
  .regex(/^[A-Za-z0-9/-]+$/, 'Formato de registro no conselho invalido.');

/**
 * Endereço do formulário (ADR-0015). Os campos textuais vêm do ViaCEP ou do
 * usuário; `cep` é validado por CONTAGEM de dígitos (a máscara é UI). `country`
 * não é campo: fixado 'BR' na normalização de envio (lançamento pt-BR).
 */
const addressFormSchema = z.object({
  cep: z.string().refine((v) => onlyDigits(v).length === 8, { message: 'Informe um CEP valido.' }),
  logradouro: z.string().trim().min(1, 'Informe o logradouro.'),
  numero: z.string().trim().min(1, 'Informe o numero.'),
  complemento: z.string().trim().optional(),
  bairro: z.string().trim().min(1, 'Informe o bairro.'),
  cidade: z.string().trim().min(1, 'Informe a cidade.'),
  state: brazilianStateInput,
});

/**
 * Schema do FORMULÁRIO de cadastro (ADR-0015). Valida os valores MASCARADOS que
 * o RHF guarda (a normalização para o fio acontece no `onSubmit`) e inclui o
 * `confirmPassword`, que é SÓ da UI — não vai no payload. O contrato real do
 * servidor é o `registerProfessionalSchema` de `@fitvo/validation` (usado pelo
 * BFF): este aqui é a camada de UX, com mensagens pt-BR e máscara.
 */
export const registerProfessionalFormSchema = z
  .object({
    specialtyId: z.string().min(1, 'Selecione uma profissao.'),
    councilDocument: councilDocumentInput,
    councilState: brazilianStateInput,
    documentType: z.enum(['CPF', 'CNPJ'], { message: 'Selecione o tipo de documento.' }),
    document: z.string().min(1, 'Informe o documento.'),
    name: registerName,
    email: registerEmail,
    password: strongRegisterPassword,
    confirmPassword: z.string().min(1, 'Confirme a senha.'),
    whatsapp: z
      .string()
      .refine((v) => onlyDigits(v).length === 11, { message: 'Informe um WhatsApp valido.' }),
    birthDate: z
      .string()
      .refine(isAtLeastEighteen, { message: 'Voce precisa ter 18 anos ou mais.' }),
    address: addressFormSchema,
    acceptedTerms: acceptedTermsInput,
  })
  .superRefine((data, ctx) => {
    // Documento: dígito verificador REAL conforme o tipo (mesma regra do
    // servidor — reusa os validadores de `@fitvo/validation`, sem duplicar).
    const digits = onlyDigits(data.document);
    const valid = data.documentType === 'CPF' ? isValidCpf(digits) : isValidCnpj(digits);
    if (!valid) {
      ctx.addIssue({
        code: 'custom',
        path: ['document'],
        message: data.documentType === 'CPF' ? 'CPF invalido.' : 'CNPJ invalido.',
      });
    }
    // Confirmação de senha — só UI, mas o erro precisa aparecer no campo certo.
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'As senhas nao coincidem.',
      });
    }
  });
export type RegisterProfessionalFormInput = z.infer<typeof registerProfessionalFormSchema>;

/**
 * Espelha `patientAcceptInviteSchema` da API. Unico caminho de nascimento de
 * conta de paciente (D-135/ADR-0015) — por isso exige o mesmo aceite de
 * termos (D-025) que antes vinha do autocadastro removido.
 */
export const acceptInviteInputSchema = z.object({
  token: z.string().min(1, 'Convite invalido.'),
  password: registerPassword,
  name: registerName,
  document: cpf,
  acceptedTerms: acceptedTermsInput,
});
export type AcceptInviteInput = z.infer<typeof acceptInviteInputSchema>;

/** Espelha `patientAcceptInviteResultSchema` — sem tokens (a conta e criada,
 * mas o login e feito a parte). */
export interface AcceptInviteResult {
  readonly patient: {
    readonly accountId: string;
    readonly tenantId: string;
    readonly patientProfileId: string;
  };
  readonly bond: { readonly id: string; readonly specialtyId: string };
  readonly created: boolean;
}

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
  /** Nome civil — uso fiscal/documento. NÃO exibir na UI: usar `displayName`. */
  readonly name: string;
  /** Nome de exibição (socialName ?? name) — derivado no servidor (spec §3.1). */
  readonly displayName: string;
  readonly emailVerified: boolean;
  /**
   * Perfil completo (spec §5) — DERIVADO no servidor. `false` manda a pessoa
   * para `/completar-perfil`. Nunca recalcular aqui: a conta é uma só, no
   * servidor (mesma doutrina do `displayName`).
   */
  readonly profileComplete: boolean;
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
/**
 * CPF do paciente — dígito verificador REAL, espelhando `cpfOnlyRefine` do
 * servidor (spec §4.6: "CPF — exatamente 11 · DV real"). Reusa o validador de
 * `@fitvo/validation`, sem duplicar a conta do DV.
 *
 * Tolera máscara na DIGITAÇÃO e normaliza para dígitos no `transform` — o fio
 * carrega só dígitos (spec §3), mas quem digita não deveria ser punido por
 * colar um CPF pontuado. Antes daqui o campo era `min(11).max(14)`, espelho do
 * schema frouxo que o servidor tinha: aceitava CPF inválido no cliente e o
 * usuário só descobria com um 400 opaco no submit.
 */
const cpf = z
  .string()
  .refine((v) => isValidCpf(onlyDigits(v)), { message: 'Informe um CPF valido.' })
  .transform(onlyDigits);

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
 * Formulário de COMPLETAR PERFIL (spec §5) — valida os valores MASCARADOS que
 * o RHF guarda; a normalização para o fio acontece no submit. Reusa as mesmas
 * peças do cadastro (`addressFormSchema`, contagem de dígitos do WhatsApp,
 * maioridade) — não é uma versão relaxada: um dado que não serviria no cadastro
 * também não serve aqui.
 *
 * Diferente do contrato do servidor (`completeProfileSchema`, onde tudo é
 * opcional para permitir preenchimento parcial), aqui os três são
 * OBRIGATÓRIOS: esta tela existe para destravar o app, e destravar exige os
 * três. Enviar menos deixaria a pessoa presa no mesmo lugar.
 */
export const completeProfileFormSchema = z.object({
  whatsapp: z
    .string()
    .refine((v) => onlyDigits(v).length === 11, { message: 'Informe um WhatsApp valido.' }),
  birthDate: z.string().refine(isAtLeastEighteen, { message: 'Voce precisa ter 18 anos ou mais.' }),
  address: addressFormSchema,
});
export type CompleteProfileFormInput = z.infer<typeof completeProfileFormSchema>;

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
    // Opcionais (spec §3.1). O Select só oferece valores válidos e o socialName
    // é texto livre — a normalização (vazio → ausente) acontece no onSubmit; o
    // gate real do gênero é o schema compartilhado do servidor.
    socialName: z.string().trim().optional(),
    gender: z.string().optional(),
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
 * Profissões que cada vertical comporta no FORMULÁRIO — espelha
 * `CLINIC_SPECIALTY_CODES`/`ACADEMY_SPECIALTY_CODES` de `@fitvo/validation`. O
 * servidor é quem decide (o BFF valida com o schema compartilhado); aqui a lista
 * existe para o formulário nem OFERECER uma profissão que a vertical recusa.
 */
export const COMPANY_SPECIALTY_CODES = {
  clinic: ['MEDICINE', 'NUTRITION', 'TRAINING', 'PERSONAL_TRAINER'],
  academy: ['TRAINING', 'PERSONAL_TRAINER'],
} as const;

export type CompanyVariant = keyof typeof COMPANY_SPECIALTY_CODES;

/**
 * Schema do FORMULÁRIO de cadastro de EMPRESA — clínica (spec §4.2 · D-139) e
 * academia (spec §4.3 · D-141). Valida os valores MASCARADOS do RHF; a
 * normalização para o fio é no `onSubmit`. Inclui `confirmPassword` (só UI). O
 * contrato real do servidor é `registerClinicSchema`/`registerAcademySchema` de
 * `@fitvo/validation` (usados pelo BFF) — este é a camada de UX, com mensagens
 * pt-BR e máscara. Empresa é SÓ CNPJ; admin é PF (CPF); conselho é condicional
 * ao "Você é?".
 *
 * Fábrica por vertical (e não dois schemas): o formulário é o MESMO — duplicá-lo
 * criaria dois lugares para corrigir cada regra de UX.
 */
export function companyFormSchema(variant: CompanyVariant) {
  const allowedSpecialtyCodes: readonly string[] = COMPANY_SPECIALTY_CODES[variant];
  return z
    .object({
      // Empresa
      legalName: z.string().trim().min(1, 'Informe a razao social.'),
      tradeName: z.string().trim().min(1, 'Informe o nome fantasia.'),
      cnpj: z
        .string()
        .refine((v) => onlyDigits(v).length === 14, { message: 'Informe um CNPJ valido.' }),
      companyEmail: z.string().email('Informe um e-mail valido.'),
      companyPhone: z.string().refine((v) => [10, 11].includes(onlyDigits(v).length), {
        message: 'Informe um telefone valido.',
      }),
      address: addressFormSchema,
      // Admin (pessoa física)
      role: z.enum(['MANAGER_ONLY', 'MANAGER_PROVIDER'], { message: 'Selecione uma opcao.' }),
      name: registerName,
      socialName: z.string().trim().optional(),
      document: z.string().min(1, 'Informe o CPF.'),
      email: registerEmail,
      password: strongRegisterPassword,
      confirmPassword: z.string().min(1, 'Confirme a senha.'),
      whatsapp: z
        .string()
        .refine((v) => onlyDigits(v).length === 11, { message: 'Informe um WhatsApp valido.' }),
      birthDate: z
        .string()
        .refine(isAtLeastEighteen, { message: 'Voce precisa ter 18 anos ou mais.' }),
      gender: z.string().optional(),
      // Condicional (só quando "também atende")
      specialtyCode: z.string().optional(),
      councilDocument: z.string().optional(),
      councilState: z.string().optional(),
      medicalSpecialty: z.string().optional(),
      acceptedTerms: acceptedTermsInput,
    })
    .superRefine((data, ctx) => {
      if (!isValidCnpj(onlyDigits(data.cnpj))) {
        ctx.addIssue({ code: 'custom', path: ['cnpj'], message: 'CNPJ invalido.' });
      }
      if (!isValidCpf(onlyDigits(data.document))) {
        ctx.addIssue({ code: 'custom', path: ['document'], message: 'CPF invalido.' });
      }
      if (data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmPassword'],
          message: 'As senhas nao coincidem.',
        });
      }
      // Conselho condicional ao "Você é?" — os campos ficam ocultos em gestor-puro,
      // então só validamos presença quando "também atende".
      if (data.role === 'MANAGER_PROVIDER') {
        if (!data.specialtyCode) {
          ctx.addIssue({
            code: 'custom',
            path: ['specialtyCode'],
            message: 'Selecione a profissao.',
          });
        }
        if (!data.councilDocument) {
          ctx.addIssue({
            code: 'custom',
            path: ['councilDocument'],
            message: 'Informe o conselho.',
          });
        }
        if (!data.councilState) {
          ctx.addIssue({ code: 'custom', path: ['councilState'], message: 'Informe a UF.' });
        }
        if (data.specialtyCode === 'MEDICINE' && !data.medicalSpecialty) {
          ctx.addIssue({
            code: 'custom',
            path: ['medicalSpecialty'],
            message: 'Selecione a especialidade medica.',
          });
        }
        if (data.specialtyCode && data.specialtyCode !== 'MEDICINE' && data.medicalSpecialty) {
          ctx.addIssue({
            code: 'custom',
            path: ['medicalSpecialty'],
            message: 'Especialidade medica so para Medico.',
          });
        }
        // Profissão fora da vertical (academia não tem médico/nutricionista —
        // D-141). O select nem oferece; isto barra um valor forjado à mão.
        if (data.specialtyCode && !allowedSpecialtyCodes.includes(data.specialtyCode)) {
          ctx.addIssue({
            code: 'custom',
            path: ['specialtyCode'],
            message: 'Profissao indisponivel para este tipo de estabelecimento.',
          });
        }
      }
    });
}

/**
 * Valores do formulário de empresa. O tipo é o MESMO nas duas verticais (a
 * `variant` muda quais profissões são aceitas, não a forma do formulário) — por
 * isso um tipo só, derivado do retorno da fábrica.
 */
export type RegisterCompanyFormInput = z.infer<ReturnType<typeof companyFormSchema>>;

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

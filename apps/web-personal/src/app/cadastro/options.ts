import { BRAZILIAN_STATES } from '@/lib/auth';

/** Opções de UI compartilhadas entre os formulários de cadastro (autônomo e clínica). */

export const BRAZILIAN_STATE_OPTIONS = BRAZILIAN_STATES.map((uf) => ({ value: uf, label: uf }));

/** Gênero (spec §3.1) — labels legíveis em pt-BR mapeados aos valores do enum. */
export const GENDER_OPTIONS = [
  { value: 'MULHER_CIS', label: 'Mulher cis' },
  { value: 'HOMEM_CIS', label: 'Homem cis' },
  { value: 'MULHER_TRANS', label: 'Mulher trans' },
  { value: 'HOMEM_TRANS', label: 'Homem trans' },
  { value: 'NAO_BINARIO', label: 'Não-binário' },
  { value: 'OUTRO', label: 'Outro' },
  { value: 'PREFIRO_NAO_INFORMAR', label: 'Prefiro não informar' },
];

/** Profissão (SpecialtyCode) — o rótulo do conselho deriva daqui (spec §4.2). */
export const SPECIALTY_CODE_OPTIONS = [
  { value: 'MEDICINE', label: 'Médico (CRM)' },
  { value: 'NUTRITION', label: 'Nutricionista (CRN)' },
  { value: 'TRAINING', label: 'Educador Físico (CREF)' },
  { value: 'PERSONAL_TRAINER', label: 'Personal Trainer (CREF)' },
];

/**
 * Profissões oferecidas por vertical. A academia comporta **só CREF** (D-141):
 * médico e nutricionista nem aparecem no select — e o servidor os recusa com 400
 * se alguém forjar o valor. Derivar o select da mesma lista evita o pior caso:
 * a UI oferecer o que o servidor recusa.
 */
export const SPECIALTY_CODE_OPTIONS_BY_VARIANT = {
  clinic: SPECIALTY_CODE_OPTIONS,
  academy: SPECIALTY_CODE_OPTIONS.filter((o) => ['TRAINING', 'PERSONAL_TRAINER'].includes(o.value)),
} as const;

/** Especialidade médica — MVP só Nutrologia/Endocrinologia (aparece só se Médico). */
export const MEDICAL_SPECIALTY_OPTIONS = [
  { value: 'NUTROLOGIA', label: 'Nutrologia' },
  { value: 'ENDOCRINOLOGIA', label: 'Endocrinologia' },
];

/**
 * "Você é?" (spec §2) — só gestor ou gestor que também atende. Vale igual nas
 * duas verticais; o que muda é o vocabulário, no `COMPANY_VARIANT_COPY`.
 */
export const COMPANY_ROLE_OPTIONS = [
  { value: 'MANAGER_ONLY', label: 'Só gestor' },
  { value: 'MANAGER_PROVIDER', label: 'Gestor que também atende' },
];

/**
 * O que difere entre as verticais NA TELA. Todo o resto do formulário é idêntico
 * (spec §4.2/§4.3) — por isso a diferença mora numa tabela, e não num segundo
 * componente.
 */
export const COMPANY_VARIANT_COPY = {
  clinic: {
    endpoint: '/api/auth/register/clinic',
    companyLegend: 'Dados da clinica',
    roleHint: 'Gestor que tambem atende informa profissao e conselho.',
  },
  academy: {
    endpoint: '/api/auth/register/academy',
    companyLegend: 'Dados da academia',
    roleHint: 'Gestor que tambem da aula informa CREF (Educador Fisico ou Personal Trainer).',
  },
} as const;

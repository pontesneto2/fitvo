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

/** Especialidade médica — MVP só Nutrologia/Endocrinologia (aparece só se Médico). */
export const MEDICAL_SPECIALTY_OPTIONS = [
  { value: 'NUTROLOGIA', label: 'Nutrologia' },
  { value: 'ENDOCRINOLOGIA', label: 'Endocrinologia' },
];

/** "Você é?" (spec §2) — só gestor ou gestor que também atende. */
export const CLINIC_ROLE_OPTIONS = [
  { value: 'MANAGER_ONLY', label: 'Só gestor' },
  { value: 'MANAGER_PROVIDER', label: 'Gestor que também atende' },
];

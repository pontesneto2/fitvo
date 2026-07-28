/** Espelha `SpecialtyView`/`SpecialtyListResult` da API (GET /v1/specialties — D-047). */
export interface Specialty {
  readonly id: string;
  readonly code: 'TRAINING' | 'NUTRITION' | 'MEDICINE' | 'PERSONAL_TRAINER';
  readonly name: string;
}

export interface SpecialtyListResult {
  readonly specialties: Specialty[];
}

/**
 * Rotulo do conselho por especialidade (D-137) — lookup fixo, os 4 valores sao
 * estaveis (mesmo enum `SpecialtyCode` do Prisma). Nao vem da API: e so texto
 * de UI, nao dado. Personal Trainer usa o mesmo conselho (CREF) de Treino —
 * sem RQE, sem segunda especialidade medica.
 */
export const COUNCIL_LABEL_BY_SPECIALTY_CODE: Record<Specialty['code'], string> = {
  TRAINING: 'CREF',
  NUTRITION: 'CRN',
  MEDICINE: 'CRM',
  PERSONAL_TRAINER: 'CREF',
};

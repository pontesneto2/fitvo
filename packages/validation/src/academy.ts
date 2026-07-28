import { z } from 'zod';

import { companyRegistrationRefine, companyRegistrationShape } from './company-registration';
import { type SpecialtyCode } from './specialty';

/**
 * Contrato da ACADEMIA (D-141) — fonte única. O cadastro é o MESMO da clínica
 * (spec §4.2/§4.3: "clínica e academia = cadastro de tenant idêntico"), por isso
 * este módulo não redefine nenhum campo: monta o schema sobre a base de empresa
 * (`company-registration.ts`) e só declara a VERTICAL.
 *
 * A vertical da academia é o que a torna diferente: **só profissões de CREF**.
 * Médico e Nutricionista são PROIBIDOS aqui — academia não é estabelecimento de
 * saúde assistencial, e um CRM/CRN nela seria um vínculo que o produto não sabe
 * (nem deve) representar. Como não há Médico, não há especialidade médica.
 */

/**
 * Profissões que a academia comporta — Educador Físico e Personal Trainer,
 * ambos de CREF (mesmo conselho, seats distintos no catálogo — D-047).
 */
export const ACADEMY_SPECIALTY_CODES: readonly SpecialtyCode[] = ['TRAINING', 'PERSONAL_TRAINER'];

/**
 * Cadastro PÚBLICO de ACADEMIA (spec §1/§2/§4.3 · D-141) — nasce
 * `Tenant(ACADEMIA)` + `Account`(admin) + membership `CLINIC_ADMIN` (+ perfil
 * profissional se "também atende"). Área crítica (LGPD + cria tenant + vínculo).
 *
 * Idêntico ao da clínica em campos, máscaras e obrigatoriedade; diverge só em
 * `allowedSpecialtyCodes`. Médico/Nutricionista → 400 pelo `.superRefine`, antes
 * de tocar o banco: profissão fora da vertical é estado irrepresentável.
 */
export const registerAcademySchema = z.object(companyRegistrationShape).superRefine(
  companyRegistrationRefine({
    allowedSpecialtyCodes: ACADEMY_SPECIALTY_CODES,
    specialtyOutOfVerticalMessage:
      'Academia aceita apenas Educador Físico ou Personal Trainer (CREF).',
  }),
);

export type RegisterAcademyInput = z.infer<typeof registerAcademySchema>;

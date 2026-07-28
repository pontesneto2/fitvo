import { z } from 'zod';

/**
 * Contrato do catalogo fixo de especialidades (D-047/D-137) — fonte única.
 * Catalogo publico, sem dado sensivel/tenant: usado pelo cadastro publico do
 * profissional autonomo para popular o select de especialidade.
 */

export const specialtyCodeSchema = z.enum([
  'TRAINING',
  'NUTRITION',
  'MEDICINE',
  'PERSONAL_TRAINER',
]);

export const specialtyViewSchema = z.object({
  id: z.string(),
  code: specialtyCodeSchema,
  name: z.string(),
});

export const specialtyListResultSchema = z.object({
  specialties: z.array(specialtyViewSchema),
});

export type SpecialtyCode = z.infer<typeof specialtyCodeSchema>;
export type SpecialtyView = z.infer<typeof specialtyViewSchema>;
export type SpecialtyListResult = z.infer<typeof specialtyListResultSchema>;

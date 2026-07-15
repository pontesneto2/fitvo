import { z } from 'zod';

/** Parametro de rota: consentimento alvo da operacao. */
export const consentParamsSchema = z.object({
  consentId: z.string().min(1),
});

/**
 * Corpo do grant de consentimento (D-016): o profissional que RECEBE o acesso
 * (grantee) + a especialidade cujo dado pode ser compartilhado. O titular
 * (paciente) vem do Bearer, nunca do corpo.
 */
export const grantConsentSchema = z.object({
  granteeProfessionalProfileId: z.string().min(1),
  specialtyId: z.string().min(1),
});

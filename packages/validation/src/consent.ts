import { z } from 'zod';

/**
 * Contrato de consentimento (D-016/D-032) — fonte única. O service já entrega
 * timestamps como ISO string (o `toView` faz `.toISOString()`), então o response
 * casa direto: sem ponte Date→ISO aqui.
 */

// ---- Params / Request ----
export const consentParamsSchema = z.object({
  consentId: z.string().min(1).describe('ID do consentimento.'),
});

export const grantConsentSchema = z.object({
  granteeProfessionalProfileId: z.string().min(1).describe('Profissional que RECEBE o acesso.'),
  specialtyId: z.string().min(1).describe('Especialidade cujo dado pode ser compartilhado.'),
});

// ---- Response ----
export const consentViewSchema = z.object({
  id: z.string(),
  granteeProfessionalProfileId: z.string(),
  specialtyId: z.string(),
  status: z.enum(['ACTIVE', 'REVOKED']),
  grantedAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
});

export const listConsentsResultSchema = z.object({
  consents: z.array(consentViewSchema),
});

// ---- Tipos de wire ----
export type ConsentParams = z.infer<typeof consentParamsSchema>;
export type GrantConsentInput = z.infer<typeof grantConsentSchema>;
export type ConsentView = z.infer<typeof consentViewSchema>;
export type ListConsentsResult = z.infer<typeof listConsentsResultSchema>;

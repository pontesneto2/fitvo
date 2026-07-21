import { z } from 'zod';

/**
 * Contrato da slice de termos (D-025/D-032) — fonte única. Aceite de Termos de
 * Uso/Política de Privacidade — conceito legal DISTINTO do dominio `consent`
 * (compartilhamento clínico entre profissionais — ADR-0003/D-016).
 */

export const termsDocumentSlugSchema = z
  .enum(['TERMS_OF_USE', 'PRIVACY_POLICY'])
  .describe('Documento de termos (catálogo fixo, extensível — D-025).');

export const termsAcceptanceStatusSchema = z.enum(['CURRENT', 'RECONSENT_REQUIRED']);

// ---- Request ----
export const acceptTermsSchema = z.object({
  slug: termsDocumentSlugSchema,
});

export const revokeTermsSchema = z.object({
  slug: termsDocumentSlugSchema,
});

// ---- Response ----
export const termsStatusViewSchema = z.object({
  slug: termsDocumentSlugSchema,
  status: termsAcceptanceStatusSchema,
});

export const termsStatusResultSchema = z.object({
  documents: z.array(termsStatusViewSchema),
});

// ---- Tipos de wire ----
export type TermsDocumentSlug = z.infer<typeof termsDocumentSlugSchema>;
export type TermsAcceptanceStatus = z.infer<typeof termsAcceptanceStatusSchema>;
export type AcceptTermsInput = z.infer<typeof acceptTermsSchema>;
export type RevokeTermsInput = z.infer<typeof revokeTermsSchema>;
export type TermsStatusView = z.infer<typeof termsStatusViewSchema>;
export type TermsStatusResult = z.infer<typeof termsStatusResultSchema>;

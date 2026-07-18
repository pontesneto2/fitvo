import { z } from 'zod';

/**
 * Contrato da clínica (D-014/D-048/D-032) — fonte única. Nomes prefixados com
 * `clinic` porque o barrel de `@fitvo/validation` é flat e `tenantParams`/
 * `invite*` colidiriam com o slice de paciente. O service já entrega timestamps
 * como ISO string (sem ponte Date→ISO aqui).
 */

// ---- Params / Request ----
export const clinicTenantParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant da clinica.'),
});

export const clinicInviteParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant da clinica.'),
  inviteId: z.string().min(1).describe('ID do convite.'),
});

export const clinicCreateInviteSchema = z.object({
  email: z.string().email().describe('E-mail do profissional convidado.'),
});

export const clinicAcceptInviteSchema = z.object({
  token: z.string().min(1).describe('Token de uso unico recebido no convite.'),
  password: z.string().min(8).describe('Senha em claro (mín. 8).'),
  name: z.string().min(1),
  document: z.string().min(11).max(18).describe('CPF ou CNPJ do profissional (D-043).'),
  documentType: z.enum(['CPF', 'CNPJ']),
});

// ---- Response ----
export const clinicInviteViewSchema = z.object({
  id: z.string(),
  email: z.string(),
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const clinicProfessionalViewSchema = z.object({
  accountId: z.string(),
  professionalProfileId: z.string(),
  name: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  joinedAt: z.iso.datetime(),
});

export const clinicCreateInviteResultSchema = z.object({
  invite: clinicInviteViewSchema,
  token: z.string(),
});

export const clinicRosterResultSchema = z.object({
  professionals: z.array(clinicProfessionalViewSchema),
  pendingInvites: z.array(clinicInviteViewSchema),
});

export const clinicAcceptInviteResultSchema = z.object({
  professional: z.object({ accountId: z.string(), tenantId: z.string() }),
  created: z.boolean(),
});

// ---- Tipos de wire ----
export type ClinicTenantParams = z.infer<typeof clinicTenantParamsSchema>;
export type ClinicInviteParams = z.infer<typeof clinicInviteParamsSchema>;
export type ClinicCreateInviteInput = z.infer<typeof clinicCreateInviteSchema>;
export type ClinicAcceptInviteInput = z.infer<typeof clinicAcceptInviteSchema>;
export type ClinicInviteView = z.infer<typeof clinicInviteViewSchema>;
export type ClinicProfessionalView = z.infer<typeof clinicProfessionalViewSchema>;
export type ClinicCreateInviteResult = z.infer<typeof clinicCreateInviteResultSchema>;
export type ClinicRosterResult = z.infer<typeof clinicRosterResultSchema>;
export type ClinicAcceptInviteResult = z.infer<typeof clinicAcceptInviteResultSchema>;

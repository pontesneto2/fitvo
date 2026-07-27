import { z } from 'zod';

import { acceptedTerms } from './auth';

/**
 * Contrato de paciente/vínculo (D-006/D-052/D-032) — fonte única. Nomes
 * prefixados com `patient` (barrel flat; colidiria com clinic). O service já
 * entrega timestamps como ISO string.
 */

const modality = z
  .enum(['ONLINE', 'PRESENCIAL', 'HIBRIDO'])
  .describe('Modalidade do atendimento (D-101). Definida pelo PROFISSIONAL.');

// ---- Params / Request ----
export const patientTenantParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
});

export const patientInviteParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
  inviteId: z.string().min(1).describe('ID do convite.'),
});

export const patientBondParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
  bondId: z.string().min(1).describe('ID do vinculo.'),
});

export const patientCreateInviteSchema = z.object({
  email: z.string().email().describe('E-mail do paciente convidado.'),
  specialtyId: z.string().min(1).describe('Especialidade-alvo do vinculo (D-052).'),
  modality,
});

export const patientAcceptInviteSchema = z.object({
  token: z.string().min(1).describe('Token de uso unico recebido no convite.'),
  password: z.string().min(8).describe('Senha em claro (mín. 8).'),
  name: z.string().min(1),
  document: z.string().min(11).max(14).describe('CPF do paciente (D-043).'),
  /**
   * Aceite dos termos (D-025). Unico caminho de nascimento de conta de
   * paciente (D-135 — ADR-0015): sem o autocadastro, o aceite de convite
   * precisa capturar o consentimento inicial que antes vinha do cadastro.
   */
  acceptedTerms,
});

// ---- Response ----
export const patientInviteViewSchema = z.object({
  id: z.string(),
  email: z.string(),
  specialtyId: z.string(),
  modality,
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const patientBondViewSchema = z.object({
  id: z.string(),
  patientProfileId: z.string(),
  patientName: z.string(),
  patientEmail: z.string(),
  specialtyId: z.string(),
  modality,
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  createdAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
});

export const patientCreateInviteResultSchema = z.object({
  invite: patientInviteViewSchema,
  token: z.string(),
});

export const patientOverviewResultSchema = z.object({
  pendingInvites: z.array(patientInviteViewSchema),
  activeBonds: z.array(patientBondViewSchema),
});

export const patientAcceptInviteResultSchema = z.object({
  patient: z.object({
    accountId: z.string(),
    tenantId: z.string(),
    patientProfileId: z.string(),
  }),
  bond: z.object({ id: z.string(), specialtyId: z.string() }),
  created: z.boolean(),
});

// ---- Tipos de wire ----
export type PatientTenantParams = z.infer<typeof patientTenantParamsSchema>;
export type PatientInviteParams = z.infer<typeof patientInviteParamsSchema>;
export type PatientBondParams = z.infer<typeof patientBondParamsSchema>;
export type PatientCreateInviteInput = z.infer<typeof patientCreateInviteSchema>;
export type PatientAcceptInviteInput = z.infer<typeof patientAcceptInviteSchema>;
export type PatientInviteView = z.infer<typeof patientInviteViewSchema>;
export type PatientBondView = z.infer<typeof patientBondViewSchema>;
export type PatientCreateInviteResult = z.infer<typeof patientCreateInviteResultSchema>;
export type PatientOverviewResult = z.infer<typeof patientOverviewResultSchema>;
export type PatientAcceptInviteResult = z.infer<typeof patientAcceptInviteResultSchema>;

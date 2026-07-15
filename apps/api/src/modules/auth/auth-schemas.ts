import { z } from 'zod';

export const registerProfessionalSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  document: z.string().min(11).max(18),
  documentType: z.enum(['CPF', 'CNPJ']),
  tenantName: z.string().min(1),
});

export const registerPatientSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  document: z.string().min(11).max(14),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

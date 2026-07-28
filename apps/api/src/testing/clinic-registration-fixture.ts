/**
 * Payload VÁLIDO de cadastro público de clínica (spec §4.2 · D-139) — base
 * `MANAGER_ONLY` (gestor-puro). Variantes ("também atende", médico) são
 * derivadas por spread nos testes. CNPJ da empresa e CPF do admin têm dígito
 * verificador REAL.
 */

/** CNPJ de teste com DV válido (empresa). */
export const VALID_CLINIC_CNPJ = '11222333000181';
/** CPF de teste com DV válido (admin pessoa física). */
export const VALID_ADMIN_CPF = '52998224725';

export const validClinicRegistration = {
  // Empresa
  legalName: 'Clinica Vida LTDA',
  tradeName: 'Clinica Vida',
  cnpj: VALID_CLINIC_CNPJ,
  companyEmail: 'contato@clinicavida.dev',
  companyPhone: '1133334444',
  address: {
    cep: '01310930',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cidade: 'Sao Paulo',
    state: 'SP',
    country: 'BR',
  },
  // Admin (gestor-puro por padrão — sem conselho)
  role: 'MANAGER_ONLY',
  name: 'Ana Gestora',
  document: VALID_ADMIN_CPF,
  email: 'ana@clinicavida.dev',
  password: 'senha-forte-123',
  whatsapp: '11987654321',
  birthDate: '1985-03-20',
  acceptedTerms: { termsOfUse: true, privacyPolicy: true },
} as const;

/** Variante "também atende" — Educador Físico (TRAINING), sem especialidade médica. */
export const validClinicProviderRegistration = {
  ...validClinicRegistration,
  role: 'MANAGER_PROVIDER',
  specialtyCode: 'TRAINING',
  councilDocument: 'CREF-123456',
  councilState: 'SP',
} as const;

/** Variante "também atende" — Médico (MEDICINE) com especialidade médica. */
export const validClinicMedicalProviderRegistration = {
  ...validClinicRegistration,
  role: 'MANAGER_PROVIDER',
  specialtyCode: 'MEDICINE',
  councilDocument: 'CRM-123456',
  councilState: 'SP',
  medicalSpecialty: 'NUTROLOGIA',
} as const;

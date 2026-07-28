/**
 * Payload VÁLIDO de cadastro público de academia (spec §4.3 · D-141) — base
 * `MANAGER_ONLY` (gestor-puro). Idêntico ao da clínica em estrutura: os dois são
 * o MESMO cadastro de empresa (spec §4.2/§4.3). A diferença é a vertical, e é
 * ela que os testes exercitam — só profissões de CREF.
 *
 * CNPJ da empresa e CPF do admin têm dígito verificador REAL.
 */

/** CNPJ de teste com DV válido (empresa). */
export const VALID_ACADEMY_CNPJ = '11222333000181';
/** CPF de teste com DV válido (admin pessoa física). */
export const VALID_ACADEMY_ADMIN_CPF = '52998224725';

export const validAcademyRegistration = {
  // Empresa
  legalName: 'Academia Forca Total LTDA',
  tradeName: 'Academia Forca Total',
  cnpj: VALID_ACADEMY_CNPJ,
  companyEmail: 'contato@forcatotal.dev',
  companyPhone: '1133334444',
  address: {
    cep: '01310930',
    logradouro: 'Avenida Paulista',
    numero: '2000',
    bairro: 'Bela Vista',
    cidade: 'Sao Paulo',
    state: 'SP',
    country: 'BR',
  },
  // Admin (gestor-puro por padrão — sem conselho)
  role: 'MANAGER_ONLY',
  name: 'Bruno Gestor',
  document: VALID_ACADEMY_ADMIN_CPF,
  email: 'bruno@forcatotal.dev',
  password: 'senha-forte-123',
  whatsapp: '11987654321',
  birthDate: '1988-06-10',
  acceptedTerms: { termsOfUse: true, privacyPolicy: true },
} as const;

/** Variante "também atende" — Educador Físico (TRAINING/CREF), o caso central da academia. */
export const validAcademyProviderRegistration = {
  ...validAcademyRegistration,
  role: 'MANAGER_PROVIDER',
  specialtyCode: 'TRAINING',
  councilDocument: 'CREF-123456',
  councilState: 'SP',
} as const;

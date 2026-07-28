/**
 * Payload VÁLIDO de cadastro de profissional autônomo (ADR-0015) — fonte única
 * para os testes de fluxo que só precisam de "um profissional existe" sem
 * exercitar cada regra de validação do cadastro.
 *
 * Centralizado de propósito: quando o contrato ganha um campo obrigatório novo
 * (whatsapp, nascimento, endereço…), atualiza-se AQUI e todos os fluxos seguem
 * verdes — sem caçar payload duplicado em sete arquivos. CPF/CNPJ são números
 * com dígito verificador REAL (o cadastro agora valida DV — D-043).
 */

/** CPF de teste com dígito verificador válido. */
export const VALID_TEST_CPF = '52998224725';
/** CNPJ de teste com dígito verificador válido. */
export const VALID_TEST_CNPJ = '11222333000181';

export const validProfessionalRegistration = {
  email: 'fixture-pro@fitvo.dev',
  password: 'senha-forte-123',
  name: 'Profissional Fixture',
  document: VALID_TEST_CPF,
  documentType: 'CPF',
  whatsapp: '11987654321',
  birthDate: '1990-01-15',
  address: {
    cep: '01310930',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cidade: 'Sao Paulo',
    state: 'SP',
    country: 'BR',
  },
  specialtyId: 'spec_training',
  councilDocument: 'CREF-123456',
  councilState: 'SP',
  acceptedTerms: { termsOfUse: true, privacyPolicy: true },
} as const;

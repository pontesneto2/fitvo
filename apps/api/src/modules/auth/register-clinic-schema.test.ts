import { describe, expect, it } from 'vitest';

import { buildTestApp } from '../../testing/build-test-app';
import {
  validClinicMedicalProviderRegistration,
  validClinicProviderRegistration,
  validClinicRegistration,
} from '../../testing/clinic-registration-fixture';

/**
 * Gate de VALIDAÇÃO do cadastro público de clínica (spec §1/§2/§4.2 · D-139) —
 * o schema é a fonte (D-032). Área crítica: cria tenant + vínculo. Cada 400 vem
 * do Zod na borda HTTP, antes de qualquer escrita. Empresa é SÓ CNPJ (DV real);
 * o admin é pessoa física (CPF, DV real); conselho é condicional ao "Você é?".
 */
async function register(body: unknown): Promise<number> {
  const app = await buildTestApp();
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/clinic',
      payload: body as Record<string, unknown>,
    });
    return res.statusCode;
  } finally {
    await app.close();
  }
}

describe('registerClinicSchema — empresa (só CNPJ, DV real)', () => {
  it('cadastro válido gestor-puro (MANAGER_ONLY) → 201', async () => {
    expect(await register({ ...validClinicRegistration, email: 'ok-gestor@fitvo.dev' })).toBe(201);
  });

  it('CNPJ com formato de CPF (11 dígitos) → 400', async () => {
    expect(
      await register({ ...validClinicRegistration, email: 'cpf@fitvo.dev', cnpj: '52998224725' }),
    ).toBe(400);
  });

  it('CNPJ com dígito verificador inválido → 400', async () => {
    expect(
      await register({
        ...validClinicRegistration,
        email: 'cnpjdv@fitvo.dev',
        cnpj: '11222333000180',
      }),
    ).toBe(400);
  });

  it('CPF do admin com dígito verificador inválido → 400', async () => {
    expect(
      await register({
        ...validClinicRegistration,
        email: 'admdv@fitvo.dev',
        document: '52998224724',
      }),
    ).toBe(400);
  });

  it('telefone da empresa com máscara (não-dígito) → 400', async () => {
    expect(
      await register({
        ...validClinicRegistration,
        email: 'fone@fitvo.dev',
        companyPhone: '(11) 3333-4444',
      }),
    ).toBe(400);
  });
});

describe('registerClinicSchema — "Você é?" conselho condicional (spec §2)', () => {
  it('MANAGER_ONLY COM conselho preenchido → 400 (proibido)', async () => {
    expect(
      await register({
        ...validClinicRegistration,
        email: 'gestor-conselho@fitvo.dev',
        councilDocument: 'CREF-123456',
        councilState: 'SP',
      }),
    ).toBe(400);
  });

  it('MANAGER_ONLY com specialtyCode → 400 (proibido)', async () => {
    expect(
      await register({
        ...validClinicRegistration,
        email: 'gestor-spec@fitvo.dev',
        specialtyCode: 'TRAINING',
      }),
    ).toBe(400);
  });

  it('MANAGER_PROVIDER SEM conselho → 400', async () => {
    const {
      councilDocument: _c,
      councilState: _u,
      ...semConselho
    } = validClinicProviderRegistration;
    expect(await register({ ...semConselho, email: 'atende-sem-conselho@fitvo.dev' })).toBe(400);
  });

  it('MANAGER_PROVIDER válido (Educador Físico) → 201', async () => {
    expect(
      await register({ ...validClinicProviderRegistration, email: 'atende-ok@fitvo.dev' }),
    ).toBe(201);
  });
});

describe('registerClinicSchema — especialidade médica (obrigatória sse Médico)', () => {
  it('Médico que atende SEM medicalSpecialty → 400', async () => {
    const { medicalSpecialty: _m, ...semMedica } = validClinicMedicalProviderRegistration;
    expect(await register({ ...semMedica, email: 'medico-sem-esp@fitvo.dev' })).toBe(400);
  });

  it('Médico que atende COM medicalSpecialty → 201', async () => {
    expect(
      await register({ ...validClinicMedicalProviderRegistration, email: 'medico-ok@fitvo.dev' }),
    ).toBe(201);
  });

  it('Nutricionista (não-médico) COM medicalSpecialty → 400', async () => {
    expect(
      await register({
        ...validClinicProviderRegistration,
        email: 'nutri-com-esp@fitvo.dev',
        specialtyCode: 'NUTRITION',
        councilDocument: 'CRN-123456',
        medicalSpecialty: 'ENDOCRINOLOGIA',
      }),
    ).toBe(400);
  });
});

describe('registerClinicSchema — admin logado após o cadastro (displayName)', () => {
  it('cadastro devolve tokens + account com displayName derivado do nome civil', async () => {
    const app = await buildTestApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/register/clinic',
        payload: {
          ...validClinicRegistration,
          email: 'admin-login@fitvo.dev',
          name: 'Ana Gestora',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.tokens.accessToken).toBeTruthy();
      expect(body.account).toMatchObject({ name: 'Ana Gestora', displayName: 'Ana Gestora' });
    } finally {
      await app.close();
    }
  });
});

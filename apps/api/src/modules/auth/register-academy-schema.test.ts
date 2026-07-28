import { describe, expect, it } from 'vitest';

import {
  validAcademyProviderRegistration,
  validAcademyRegistration,
} from '../../testing/academy-registration-fixture';
import { buildTestApp } from '../../testing/build-test-app';

/**
 * Gate de VALIDAÇÃO do cadastro público de ACADEMIA (spec §1/§2/§4.3 · D-141) —
 * o schema é a fonte (D-032). Área crítica: cria tenant + vínculo.
 *
 * O foco destes testes é a VERTICAL, que é a única coisa que a academia muda em
 * relação à clínica: **só CREF**. As regras que a academia HERDA da base de
 * empresa (DV do CNPJ/CPF, conselho condicional ao "Você é?") já são cobertas
 * por `register-clinic-schema.test.ts` sobre a MESMA base — reprová-las de novo
 * aqui testaria o mesmo código duas vezes. O que não é herdado, é testado aqui.
 */
async function register(body: unknown): Promise<number> {
  const app = await buildTestApp();
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/academy',
      payload: body as Record<string, unknown>,
    });
    return res.statusCode;
  } finally {
    await app.close();
  }
}

describe('registerAcademySchema — vertical: SÓ profissões de CREF (D-141)', () => {
  it('MANAGER_PROVIDER Educador Físico (TRAINING) → 201', async () => {
    expect(
      await register({ ...validAcademyProviderRegistration, email: 'edfisico@fitvo.dev' }),
    ).toBe(201);
  });

  it('MANAGER_PROVIDER Personal Trainer → 201', async () => {
    expect(
      await register({
        ...validAcademyProviderRegistration,
        email: 'personal@fitvo.dev',
        specialtyCode: 'PERSONAL_TRAINER',
      }),
    ).toBe(201);
  });

  it('MÉDICO na academia → 400 (proibido: academia não é estabelecimento de medicina)', async () => {
    expect(
      await register({
        ...validAcademyProviderRegistration,
        email: 'medico-academia@fitvo.dev',
        specialtyCode: 'MEDICINE',
        councilDocument: 'CRM-123456',
      }),
    ).toBe(400);
  });

  it('MÉDICO com especialidade médica na academia → 400 (nem com medicalSpecialty passa)', async () => {
    expect(
      await register({
        ...validAcademyProviderRegistration,
        email: 'medico-esp-academia@fitvo.dev',
        specialtyCode: 'MEDICINE',
        councilDocument: 'CRM-123456',
        medicalSpecialty: 'NUTROLOGIA',
      }),
    ).toBe(400);
  });

  it('NUTRICIONISTA na academia → 400 (proibido)', async () => {
    expect(
      await register({
        ...validAcademyProviderRegistration,
        email: 'nutri-academia@fitvo.dev',
        specialtyCode: 'NUTRITION',
        councilDocument: 'CRN-123456',
      }),
    ).toBe(400);
  });

  it('Educador Físico COM especialidade médica → 400 (não existe médica fora da Medicina)', async () => {
    expect(
      await register({
        ...validAcademyProviderRegistration,
        email: 'cref-com-esp@fitvo.dev',
        medicalSpecialty: 'ENDOCRINOLOGIA',
      }),
    ).toBe(400);
  });
});

describe('registerAcademySchema — cadastro de empresa (herdado da base — spec §4.2/§4.3)', () => {
  it('gestor-puro (MANAGER_ONLY) válido → 201', async () => {
    expect(
      await register({ ...validAcademyRegistration, email: 'gestor-academia@fitvo.dev' }),
    ).toBe(201);
  });

  it('gestor-puro COM conselho → 400 (gestor-puro nunca informa conselho)', async () => {
    expect(
      await register({
        ...validAcademyRegistration,
        email: 'gestor-conselho-academia@fitvo.dev',
        councilDocument: 'CREF-123456',
        councilState: 'SP',
      }),
    ).toBe(400);
  });

  it('academia SEM CNPJ válido → 400 (empresa é sempre CNPJ com DV real)', async () => {
    expect(
      await register({
        ...validAcademyRegistration,
        email: 'cnpj-invalido-academia@fitvo.dev',
        cnpj: '11222333000180',
      }),
    ).toBe(400);
  });
});

describe('registerAcademySchema — admin logado após o cadastro', () => {
  it('cadastro devolve tokens + account com displayName derivado', async () => {
    const app = await buildTestApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/register/academy',
        payload: {
          ...validAcademyRegistration,
          email: 'admin-academia-login@fitvo.dev',
          name: 'Bruno Gestor',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.tokens.accessToken).toBeTruthy();
      expect(body.account).toMatchObject({ name: 'Bruno Gestor', displayName: 'Bruno Gestor' });
    } finally {
      await app.close();
    }
  });
});

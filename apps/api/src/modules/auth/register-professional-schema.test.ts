import { describe, expect, it } from 'vitest';

import { buildTestApp } from '../../testing/build-test-app';
import {
  VALID_TEST_CNPJ,
  validProfessionalRegistration,
} from '../../testing/professional-registration-fixture';

/**
 * Gate de VALIDAÇÃO do cadastro de profissional autônomo (ADR-0015) — o schema
 * é a fonte (D-032). Cada teste reprova ANTES de qualquer escrita: o 400 vem do
 * Zod na borda HTTP, não de uma checagem espalhada. Área crítica (LGPD — dado
 * pessoal): os campos novos são obrigatórios e o documento tem dígito
 * verificador REAL.
 */

/** Payload válido base, com um override por caso. `email` único por teste (conta é por e-mail). */
function payload(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...validProfessionalRegistration, ...overrides };
}

async function register(body: Record<string, unknown>): Promise<number> {
  const app = await buildTestApp();
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: body,
    });
    return res.statusCode;
  } finally {
    await app.close();
  }
}

describe('registerProfessionalSchema — campos obrigatórios (ADR-0015)', () => {
  it('cadastro válido completo retorna 201', async () => {
    expect(await register(payload({ email: 'ok@fitvo.dev' }))).toBe(201);
  });

  it('sem whatsapp → 400', async () => {
    const { whatsapp: _omit, ...rest } = validProfessionalRegistration;
    expect(await register({ ...rest, email: 'nowa@fitvo.dev' })).toBe(400);
  });

  it('sem birthDate → 400', async () => {
    const { birthDate: _omit, ...rest } = validProfessionalRegistration;
    expect(await register({ ...rest, email: 'nobd@fitvo.dev' })).toBe(400);
  });

  it('sem address → 400', async () => {
    const { address: _omit, ...rest } = validProfessionalRegistration;
    expect(await register({ ...rest, email: 'noaddr@fitvo.dev' })).toBe(400);
  });

  it('address incompleto (sem cidade) → 400', async () => {
    const { cidade: _omit, ...addr } = validProfessionalRegistration.address;
    expect(await register(payload({ email: 'addr2@fitvo.dev', address: addr }))).toBe(400);
  });

  it('whatsapp com máscara (não-dígito) → 400', async () => {
    expect(
      await register(payload({ email: 'wamask@fitvo.dev', whatsapp: '(11) 98765-4321' })),
    ).toBe(400);
  });

  it('cep com máscara (não-dígito) → 400', async () => {
    const address = { ...validProfessionalRegistration.address, cep: '01310-930' };
    expect(await register(payload({ email: 'cepmask@fitvo.dev', address }))).toBe(400);
  });
});

describe('registerProfessionalSchema — documento CPF/CNPJ com dígito verificador (D-043)', () => {
  it('documentType=CPF com 14 dígitos → 400', async () => {
    expect(
      await register(
        payload({ email: 'cpf14@fitvo.dev', documentType: 'CPF', document: VALID_TEST_CNPJ }),
      ),
    ).toBe(400);
  });

  it('documentType=CNPJ com 11 dígitos → 400', async () => {
    expect(
      await register(
        payload({ email: 'cnpj11@fitvo.dev', documentType: 'CNPJ', document: '52998224725' }),
      ),
    ).toBe(400);
  });

  it('CPF com dígito verificador inválido → 400', async () => {
    expect(
      await register(
        payload({ email: 'cpfdv@fitvo.dev', documentType: 'CPF', document: '52998224724' }),
      ),
    ).toBe(400);
  });

  it('CNPJ com dígito verificador inválido → 400', async () => {
    expect(
      await register(
        payload({ email: 'cnpjdv@fitvo.dev', documentType: 'CNPJ', document: '11222333000180' }),
      ),
    ).toBe(400);
  });

  it('CNPJ válido com documentType=CNPJ → 201', async () => {
    expect(
      await register(
        payload({ email: 'cnpjok@fitvo.dev', documentType: 'CNPJ', document: VALID_TEST_CNPJ }),
      ),
    ).toBe(201);
  });
});

describe('registerProfessionalSchema — força de senha (gate de servidor)', () => {
  it('senha sem número → 400', async () => {
    expect(
      await register(payload({ email: 'pwnum@fitvo.dev', password: 'senhasomenteletras' })),
    ).toBe(400);
  });

  it('senha sem letra → 400', async () => {
    expect(await register(payload({ email: 'pwletra@fitvo.dev', password: '123456789' }))).toBe(
      400,
    );
  });

  it('senha com menos de 8 caracteres → 400', async () => {
    expect(await register(payload({ email: 'pwmin@fitvo.dev', password: 'a1b2c3' }))).toBe(400);
  });
});

describe('registerProfessionalSchema — maioridade (D-044)', () => {
  it('menor de 18 → 400', async () => {
    const recent = new Date();
    const under18 = `${recent.getUTCFullYear() - 10}-01-15`;
    expect(await register(payload({ email: 'minor@fitvo.dev', birthDate: under18 }))).toBe(400);
  });

  it('data de nascimento com formato inválido → 400', async () => {
    expect(await register(payload({ email: 'baddate@fitvo.dev', birthDate: '15/01/1990' }))).toBe(
      400,
    );
  });
});

describe('registerProfessionalSchema — nome social e gênero (spec §3.1, opcionais)', () => {
  it('sem socialName e sem gender → 201 (ambos opcionais)', async () => {
    const { gender: _g, ...rest } = validProfessionalRegistration;
    expect(await register({ ...rest, email: 'sem-sn-genero@fitvo.dev' })).toBe(201);
  });

  it('com socialName e gender válidos → 201', async () => {
    expect(
      await register(
        payload({ email: 'com-sn@fitvo.dev', socialName: 'Lia', gender: 'MULHER_TRANS' }),
      ),
    ).toBe(201);
  });

  it('gender fora do enum → 400', async () => {
    expect(
      await register(payload({ email: 'genero-invalido@fitvo.dev', gender: 'OUTRA_COISA' })),
    ).toBe(400);
  });

  it('socialName vazio (só espaços) → 400 (se enviado, não pode ser vazio)', async () => {
    expect(await register(payload({ email: 'sn-vazio@fitvo.dev', socialName: '   ' }))).toBe(400);
  });
});

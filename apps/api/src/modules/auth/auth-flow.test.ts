import { describe, expect, it } from 'vitest';

import { buildTestApp, buildTestHarness } from '../../testing/build-test-app';
import { createPatientViaInvite } from '../../testing/patient-invite-fixture';
import { validProfessionalRegistration } from '../../testing/professional-registration-fixture';

const professional = { ...validProfessionalRegistration, email: 'leo@fitvo.dev', name: 'Leo' };

describe('fluxo de autenticacao (E2E via inject)', () => {
  it('registra profissional, faz login, refresh e logout', async () => {
    const app = await buildTestApp();

    const register = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: professional,
    });
    expect(register.statusCode).toBe(201);
    expect(register.json().tokens.accessToken).toBeTruthy();

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: professional.email, password: professional.password },
    });
    expect(login.statusCode).toBe(200);
    const { tokens, account } = login.json();
    expect(account.email).toBe(professional.email);

    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: tokens.refreshToken },
    });
    expect(refresh.statusCode).toBe(200);
    expect(refresh.json().tokens.accessToken).toBeTruthy();

    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(logout.statusCode).toBe(204);

    await app.close();
  });

  it('rejeita login com senha errada com 401 RFC 7807', async () => {
    const harness = await buildTestHarness();
    await createPatientViaInvite(harness, {
      email: 'ana@fitvo.dev',
      password: 'senha-forte-123',
      name: 'Ana',
      document: '52998224725',
    });

    const bad = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'ana@fitvo.dev', password: 'errada' },
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.headers['content-type']).toContain('application/problem+json');
    expect(bad.json().title).toBe('Credenciais invalidas');

    await harness.app.close();
  });

  it('rejeita cadastro de profissional sem specialtyId/councilDocument/councilState (400)', async () => {
    const app = await buildTestApp();
    const { specialtyId, councilDocument, councilState, ...withoutSpecialtyFields } = professional;
    void specialtyId;
    void councilDocument;
    void councilState;

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: withoutSpecialtyFields,
    });
    expect(response.statusCode).toBe(400);

    await app.close();
  });

  it('cadastro valido cria a ProfessionalSpecialty (PENDING) junto da conta (D-137)', async () => {
    const harness = await buildTestHarness();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...professional, email: 'especialidade@fitvo.dev' },
    });
    expect(response.statusCode).toBe(201);
    const accountId = response.json().account.id as string;

    const specialty = harness.accounts.getProfessionalSpecialty(accountId);
    expect(specialty).toMatchObject({
      specialtyId: 'spec_training',
      councilDocument: 'CREF-123456',
      councilState: 'SP',
      verificationStatus: 'PENDING',
    });

    await harness.app.close();
  });

  it('cadastro com Personal Trainer (4a especialidade) cria a ProfessionalSpecialty (CREF) na mesma transacao', async () => {
    const harness = await buildTestHarness();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: {
        ...professional,
        email: 'personal-trainer@fitvo.dev',
        specialtyId: 'spec_personal_trainer',
        councilDocument: 'CREF-654321',
      },
    });
    expect(response.statusCode).toBe(201);
    const accountId = response.json().account.id as string;

    const specialty = harness.accounts.getProfessionalSpecialty(accountId);
    expect(specialty).toMatchObject({
      specialtyId: 'spec_personal_trainer',
      councilDocument: 'CREF-654321',
      councilState: 'SP',
      verificationStatus: 'PENDING',
    });

    await harness.app.close();
  });

  it('rejeita cadastro com specialtyId fora do catalogo (404)', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: {
        ...professional,
        email: 'sem-especialidade@fitvo.dev',
        specialtyId: 'spec_inexistente',
      },
    });
    expect(response.statusCode).toBe(404);

    await app.close();
  });

  it('rejeita corpo invalido com 400 e lista de erros', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'nao-e-email' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().errors).toBeTruthy();

    await app.close();
  });

  it('bloqueia e-mail duplicado com 409', async () => {
    const app = await buildTestApp();
    const first = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: professional,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: professional,
    });
    expect(second.statusCode).toBe(409);

    await app.close();
  });
});

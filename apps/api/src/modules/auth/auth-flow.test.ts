import { describe, expect, it } from 'vitest';

import { buildTestApp } from '../../testing/build-test-app';

const acceptedTerms = { termsOfUse: true, privacyPolicy: true } as const;

const professional = {
  email: 'leo@fitvo.dev',
  password: 'senha-forte-123',
  name: 'Leo',
  document: '12345678901',
  documentType: 'CPF',
  tenantName: 'Leo Personal',
  acceptedTerms,
};

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
    const app = await buildTestApp();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register/patient',
      payload: {
        email: 'ana@fitvo.dev',
        password: 'senha-forte-123',
        name: 'Ana',
        document: '12345678901',
        acceptedTerms,
      },
    });

    const bad = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'ana@fitvo.dev', password: 'errada' },
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.headers['content-type']).toContain('application/problem+json');
    expect(bad.json().title).toBe('Credenciais invalidas');

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

import { describe, expect, it } from 'vitest';

import { buildTestHarness } from '../../testing/build-test-app';

const professional = {
  email: 'leo@fitvo.dev',
  password: 'senha-forte-123',
  name: 'Leo',
  document: '12345678901',
  documentType: 'CPF',
  tenantName: 'Leo Personal',
  acceptedTerms: { termsOfUse: true, privacyPolicy: true },
};

async function register(app: Awaited<ReturnType<typeof buildTestHarness>>['app']): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: professional,
  });
  expect(response.statusCode).toBe(201);
  return response.json().tokens.refreshToken;
}

describe('recuperacao de senha (E2E via inject)', () => {
  it('forgot -> reset -> login com a nova senha; sessoes antigas revogadas', async () => {
    const { app, emails } = await buildTestHarness();
    const oldRefreshToken = await register(app);

    const forgot = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: professional.email },
    });
    expect(forgot.statusCode).toBe(202);
    expect(forgot.json()).toMatchObject({ status: 'accepted' });

    const token = emails.lastToken('reset', professional.email);
    expect(token).toBeTruthy();

    const reset = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { token, password: 'nova-senha-forte-999' },
    });
    expect(reset.statusCode).toBe(204);

    // a senha antiga nao autentica mais
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: professional.email, password: professional.password },
    });
    expect(oldLogin.statusCode).toBe(401);

    // a nova senha autentica
    const newLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: professional.email, password: 'nova-senha-forte-999' },
    });
    expect(newLogin.statusCode).toBe(200);

    // sessao anterior revogada: o refresh do cadastro nao rotaciona mais
    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: oldRefreshToken },
    });
    expect(refresh.statusCode).toBe(401);

    await app.close();
  });

  it('forgot-password de e-mail desconhecido tambem devolve 202 (sem vazar)', async () => {
    const { app, emails } = await buildTestHarness();
    const forgot = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'ninguem@fitvo.dev' },
    });
    expect(forgot.statusCode).toBe(202);
    expect(emails.sent).toHaveLength(0);

    await app.close();
  });

  it('token de reset e de uso unico: o reuso retorna 400', async () => {
    const { app, emails } = await buildTestHarness();
    await register(app);
    await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: professional.email },
    });
    const token = emails.lastToken('reset', professional.email);

    const first = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { token, password: 'outra-senha-forte-123' },
    });
    expect(first.statusCode).toBe(204);

    const second = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { token, password: 'terceira-senha-forte-123' },
    });
    expect(second.statusCode).toBe(400);
    expect(second.headers['content-type']).toContain('application/problem+json');

    await app.close();
  });
});

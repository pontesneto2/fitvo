import { describe, expect, it } from 'vitest';

import { buildTestHarness } from '../../testing/build-test-app';

const professional = {
  email: 'leo@fitvo.dev',
  password: 'senha-forte-123',
  name: 'Leo',
  document: '12345678901',
  documentType: 'CPF',
  tenantName: 'Leo Personal',
};

const patient = {
  email: 'ana@fitvo.dev',
  password: 'senha-forte-123',
  name: 'Ana',
  document: '12345678901',
};

describe('verificacao de e-mail (E2E via inject)', () => {
  it('envia token no cadastro, verifica e reflete em /me', async () => {
    const { app, emails } = await buildTestHarness();

    const register = await app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: professional,
    });
    expect(register.statusCode).toBe(201);
    const { tokens } = register.json();

    // /me antes de verificar: emailVerified = false
    const before = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toMatchObject({ email: professional.email, emailVerified: false });

    // o cadastro disparou um e-mail de verificacao com token
    const token = emails.lastToken('verification', professional.email);
    expect(token).toBeTruthy();

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { token },
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json()).toMatchObject({ verified: true });

    // /me depois de verificar: emailVerified = true
    const after = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(after.json().emailVerified).toBe(true);

    await app.close();
  });

  it('reenvia a verificacao (202) e o novo token verifica a conta', async () => {
    const { app, emails } = await buildTestHarness();
    await app.inject({ method: 'POST', url: '/v1/auth/register/patient', payload: patient });

    const sentOnRegister = emails.sent.length;
    const resend = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email/request',
      payload: { email: patient.email },
    });
    expect(resend.statusCode).toBe(202);
    expect(resend.json()).toMatchObject({ status: 'accepted' });
    expect(emails.sent.length).toBe(sentOnRegister + 1);

    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { token: emails.lastToken('verification', patient.email) },
    });
    expect(verify.statusCode).toBe(200);

    await app.close();
  });

  it('reenvio nao vaza existencia de conta (202 e nenhum e-mail p/ desconhecido)', async () => {
    const { app, emails } = await buildTestHarness();
    const resend = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email/request',
      payload: { email: 'ninguem@fitvo.dev' },
    });
    expect(resend.statusCode).toBe(202);
    expect(emails.sent).toHaveLength(0);

    await app.close();
  });

  it('rejeita token de verificacao invalido com 400 RFC 7807', async () => {
    const { app } = await buildTestHarness();
    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email',
      payload: { token: 'token-invalido' },
    });
    expect(verify.statusCode).toBe(400);
    expect(verify.headers['content-type']).toContain('application/problem+json');
    expect(verify.json().title).toBe('Token invalido ou expirado');

    await app.close();
  });

  it('rejeita /me sem Bearer com 401', async () => {
    const { app } = await buildTestHarness();
    const me = await app.inject({ method: 'GET', url: '/v1/auth/me' });
    expect(me.statusCode).toBe(401);

    await app.close();
  });
});

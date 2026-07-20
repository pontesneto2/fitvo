import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';
import { hashInviteToken } from './invite-token';

const CLINIC_TENANT = 'clinic_test_1';

const adminPayload = {
  email: 'admin@fitvo.dev',
  password: 'senha-forte-123',
  name: 'Admin Clinica',
  document: '12345678901',
  documentType: 'CPF',
  tenantName: 'Clinica Vida (solo do admin)',
};

/**
 * Registra o admin (via auth), o torna CLINIC_ADMIN do tenant de teste e marca
 * o e-mail como verificado (D-029) — convidar exige o gate; o teste do gate em
 * si usa um admin NAO verificado a parte.
 */
async function setupAdmin(harness: TestHarness): Promise<{ accountId: string; token: string }> {
  const res = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: adminPayload,
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  await harness.accounts.markEmailVerified(body.account.id);
  harness.clinic.seedAdmin(body.account.id, CLINIC_TENANT);
  return { accountId: body.account.id, token: body.tokens.accessToken };
}

function createInvite(app: FastifyInstance, token: string, email: string) {
  return app.inject({
    method: 'POST',
    url: `/v1/clinic/${CLINIC_TENANT}/invites`,
    headers: { authorization: `Bearer ${token}` },
    payload: { email },
  });
}

function accept(app: FastifyInstance, token: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/clinic/invites/accept',
    payload: {
      token,
      password: 'senha-forte-456',
      name: 'Novo Profissional',
      document: '98765432100',
      documentType: 'CPF',
    },
  });
}

function roster(app: FastifyInstance, token: string) {
  return app.inject({
    method: 'GET',
    url: `/v1/clinic/${CLINIC_TENANT}/professionals`,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('fluxo de clinica e convites (E2E via inject)', () => {
  it('admin cria convite, profissional aceita e passa a integrar a clinica', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);

    const invited = await createInvite(harness.app, admin.token, 'pro@fitvo.dev');
    expect(invited.statusCode).toBe(201);
    const { invite, token } = invited.json();
    expect(invite.status).toBe('PENDING');
    expect(invite.email).toBe('pro@fitvo.dev');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const accepted = await accept(harness.app, token);
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json()).toMatchObject({
      created: true,
      professional: { tenantId: CLINIC_TENANT },
    });

    const list = await roster(harness.app, admin.token);
    expect(list.statusCode).toBe(200);
    const { professionals, pendingInvites } = list.json();
    expect(pendingInvites).toHaveLength(0);
    expect(professionals).toHaveLength(1);
    expect(professionals[0]).toMatchObject({ email: 'pro@fitvo.dev', name: 'Novo Profissional' });

    await harness.app.close();
  });

  it('nega criacao de convite a quem nao e admin da clinica (403) e sem token (401)', async () => {
    const harness = await buildTestHarness();

    // Profissional comum (registrado, mas sem membership na clinica alvo).
    const outsider = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...adminPayload, email: 'outro@fitvo.dev', tenantName: 'Outro Solo' },
    });
    const outsiderToken = outsider.json().tokens.accessToken;

    const forbidden = await createInvite(harness.app, outsiderToken, 'pro@fitvo.dev');
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.headers['content-type']).toContain('application/problem+json');

    const unauthorized = await harness.app.inject({
      method: 'POST',
      url: `/v1/clinic/${CLINIC_TENANT}/invites`,
      payload: { email: 'pro@fitvo.dev' },
    });
    expect(unauthorized.statusCode).toBe(401);

    await harness.app.close();
  });

  it('gate de e-mail verificado (D-029): admin nao verificado nao convida; verificado passa', async () => {
    const harness = await buildTestHarness();

    const res = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: adminPayload,
    });
    const body = res.json();
    harness.clinic.seedAdmin(body.account.id, CLINIC_TENANT);
    const token = body.tokens.accessToken;

    const blocked = await createInvite(harness.app, token, 'pro@fitvo.dev');
    expect(blocked.statusCode).toBe(403);
    expect(blocked.headers['content-type']).toContain('application/problem+json');
    expect(blocked.json()).toMatchObject({
      type: 'https://fitvo.dev/problems/email-not-verified',
    });

    await harness.accounts.markEmailVerified(body.account.id);
    const created = await createInvite(harness.app, token, 'pro@fitvo.dev');
    expect(created.statusCode).toBe(201);

    await harness.app.close();
  });

  it('admin revoga um convite pendente; o token revogado nao pode ser aceito', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);

    const invited = await createInvite(harness.app, admin.token, 'pro@fitvo.dev');
    const { invite, token } = invited.json();

    const revoked = await harness.app.inject({
      method: 'POST',
      url: `/v1/clinic/${CLINIC_TENANT}/invites/${invite.id}/revoke`,
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(revoked.statusCode).toBe(204);

    // Ja nao aparece como pendente.
    const list = await roster(harness.app, admin.token);
    expect(list.json().pendingInvites).toHaveLength(0);

    // Token revogado -> aceite invalido.
    const accepted = await accept(harness.app, token);
    expect(accepted.statusCode).toBe(400);

    // Revogar convite inexistente -> 404.
    const missing = await harness.app.inject({
      method: 'POST',
      url: `/v1/clinic/${CLINIC_TENANT}/invites/inv_inexistente/revoke`,
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(missing.statusCode).toBe(404);

    await harness.app.close();
  });

  it('rejeita aceite com token invalido (400)', async () => {
    const harness = await buildTestHarness();
    const accepted = await accept(harness.app, 'token-que-nao-existe');
    expect(accepted.statusCode).toBe(400);
    expect(accepted.json().title).toBe('Convite invalido ou expirado');
    await harness.app.close();
  });

  it('rejeita aceite com token expirado (400)', async () => {
    const harness = await buildTestHarness();
    // Convite semeado ja expirado (expiresAt no passado).
    await harness.clinic.createInvite({
      tenantId: CLINIC_TENANT,
      email: 'exp@fitvo.dev',
      tokenHash: hashInviteToken('raw-expirado'),
      expiresAt: new Date(Date.now() - 1_000),
    });
    const accepted = await accept(harness.app, 'raw-expirado');
    expect(accepted.statusCode).toBe(400);
    await harness.app.close();
  });

  it('aceite e de uso unico: reutilizar o mesmo token falha (400)', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);
    const { token } = (await createInvite(harness.app, admin.token, 'pro@fitvo.dev')).json();

    expect((await accept(harness.app, token)).statusCode).toBe(201);
    expect((await accept(harness.app, token)).statusCode).toBe(400);

    await harness.app.close();
  });

  it('bloqueia convite pendente duplicado para o mesmo e-mail (409)', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);

    expect((await createInvite(harness.app, admin.token, 'pro@fitvo.dev')).statusCode).toBe(201);
    const dup = await createInvite(harness.app, admin.token, 'pro@fitvo.dev');
    expect(dup.statusCode).toBe(409);

    await harness.app.close();
  });

  it('valida o corpo do convite (e-mail invalido -> 400)', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);
    const bad = await createInvite(harness.app, admin.token, 'nao-e-email');
    expect(bad.statusCode).toBe(400);
    expect(bad.json().errors).toBeTruthy();
    await harness.app.close();
  });
});

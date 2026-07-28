import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';
import { validProfessionalRegistration } from '../../testing/professional-registration-fixture';
import { hashInviteToken } from './invite-token';

const CLINIC_TENANT = 'clinic_test_1';

const adminPayload = {
  ...validProfessionalRegistration,
  email: 'admin@fitvo.dev',
  name: 'Admin Clinica',
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

/** Convite valido padrao: TRAINING (CREF) sem especialidade medica. */
const TRAINING_INVITE = {
  specialtyCode: 'TRAINING' as const,
  councilDocument: 'CREF-999999',
  councilState: 'SP' as const,
};

function createInvite(
  app: FastifyInstance,
  token: string,
  email: string,
  overrides: Record<string, unknown> = {},
) {
  return app.inject({
    method: 'POST',
    url: `/v1/clinic/${CLINIC_TENANT}/invites`,
    headers: { authorization: `Bearer ${token}` },
    payload: { email, ...TRAINING_INVITE, ...overrides },
  });
}

function accept(app: FastifyInstance, token: string, overrides: Record<string, unknown> = {}) {
  return app.inject({
    method: 'POST',
    url: '/v1/clinic/invites/accept',
    payload: {
      token,
      password: 'senha-forte-456',
      name: 'Novo Profissional',
      document: '98765432100',
      documentType: 'CPF',
      acceptedTerms: { termsOfUse: true, privacyPolicy: true },
      ...overrides,
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
      payload: { ...adminPayload, email: 'outro@fitvo.dev' },
    });
    const outsiderToken = outsider.json().tokens.accessToken;

    const forbidden = await createInvite(harness.app, outsiderToken, 'pro@fitvo.dev');
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.headers['content-type']).toContain('application/problem+json');

    const unauthorized = await harness.app.inject({
      method: 'POST',
      url: `/v1/clinic/${CLINIC_TENANT}/invites`,
      payload: { email: 'pro@fitvo.dev', ...TRAINING_INVITE },
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
      specialtyCode: 'TRAINING',
      councilDocument: 'CREF-999999',
      councilState: 'SP',
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

  it('superRefine: convite MEDICINE SEM medicalSpecialty -> 400', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);
    const bad = await createInvite(harness.app, admin.token, 'med@fitvo.dev', {
      specialtyCode: 'MEDICINE',
      councilDocument: 'CRM-12345',
      // medicalSpecialty ausente de proposito
    });
    expect(bad.statusCode).toBe(400);
    await harness.app.close();
  });

  it('superRefine: convite NUTRITION COM medicalSpecialty -> 400', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);
    const bad = await createInvite(harness.app, admin.token, 'nut@fitvo.dev', {
      specialtyCode: 'NUTRITION',
      councilDocument: 'CRN-12345',
      medicalSpecialty: 'NUTROLOGIA', // proibido fora de MEDICINE
    });
    expect(bad.statusCode).toBe(400);
    await harness.app.close();
  });

  it('convite valido MEDICINE + NUTROLOGIA -> 201', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);
    const ok = await createInvite(harness.app, admin.token, 'med@fitvo.dev', {
      specialtyCode: 'MEDICINE',
      councilDocument: 'CRM-12345',
      medicalSpecialty: 'ENDOCRINOLOGIA',
    });
    expect(ok.statusCode).toBe(201);
    await harness.app.close();
  });

  it('aceite conta NOVA SEM acceptedTerms -> 400 (D-025); com aceite grava termos x2', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);
    const { token } = (await createInvite(harness.app, admin.token, 'pro@fitvo.dev')).json();

    // Sem acceptedTerms: Zod barra antes de qualquer conta nascer.
    const noTerms = await accept(harness.app, token, { acceptedTerms: undefined });
    expect(noTerms.statusCode).toBe(400);

    // Com aceite: cria a conta e grava um evento ACCEPTED por documento (x2).
    const ok = await accept(harness.app, token);
    expect(ok.statusCode).toBe(201);
    const accountId = ok.json().professional.accountId;
    // Um evento ACCEPTED por documento obrigatorio (D-025): x2 no total.
    expect(harness.terms.listEventsForAccount(accountId, 'TERMS_OF_USE')).toHaveLength(1);
    expect(harness.terms.listEventsForAccount(accountId, 'PRIVACY_POLICY')).toHaveLength(1);

    await harness.app.close();
  });

  it('aceite cria a ProfessionalSpecialty do convite (MEDICINE -> medicalSpecialty preenchida)', async () => {
    const harness = await buildTestHarness();
    const admin = await setupAdmin(harness);
    const { token } = (
      await createInvite(harness.app, admin.token, 'med@fitvo.dev', {
        specialtyCode: 'MEDICINE',
        councilDocument: 'CRM-12345',
        medicalSpecialty: 'NUTROLOGIA',
      })
    ).json();

    const ok = await accept(harness.app, token);
    expect(ok.statusCode).toBe(201);

    const specialties = harness.clinic.listProfessionalSpecialties();
    expect(specialties).toHaveLength(1);
    expect(specialties[0]).toMatchObject({
      specialtyId: 'spec_medicine',
      councilDocument: 'CRM-12345',
      councilState: 'SP',
      medicalSpecialty: 'NUTROLOGIA',
      verificationStatus: 'PENDING',
    });

    await harness.app.close();
  });
});

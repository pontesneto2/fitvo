import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';

const SPECIALTY = 'spec_training';
const GRANTEE = 'pp_grantee';

const patientPayload = {
  email: 'paciente@fitvo.dev',
  password: 'senha-forte-123',
  name: 'Paciente',
  document: '12345678901',
  documentType: 'CPF',
  tenantName: 'Estudio (solo)',
  specialtyId: 'spec_training',
  councilDocument: 'CREF-123456',
  councilState: 'SP',
  acceptedTerms: { termsOfUse: true, privacyPolicy: true },
};

/**
 * Registra uma conta (via auth) e arranja o mundo do consentimento no repo em
 * memoria: perfil de paciente para a conta, profissional grantee valido e um
 * vinculo ATIVO na especialidade. Retorna o token do paciente.
 */
async function setupPatient(
  harness: TestHarness,
  options: { withActiveBond?: boolean } = {},
): Promise<{ token: string; patientProfileId: string }> {
  const res = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: patientPayload,
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  const patientProfileId = harness.consent.seedPatientProfile(body.account.id);
  harness.consent.seedProfessional(GRANTEE);
  if (options.withActiveBond ?? true) {
    harness.consent.seedActiveBond({ patientProfileId, specialtyId: SPECIALTY });
  }
  return { token: body.tokens.accessToken, patientProfileId };
}

function grant(
  app: FastifyInstance,
  token: string,
  granteeProfessionalProfileId = GRANTEE,
  specialtyId = SPECIALTY,
) {
  return app.inject({
    method: 'POST',
    url: '/v1/consents',
    headers: { authorization: `Bearer ${token}` },
    payload: { granteeProfessionalProfileId, specialtyId },
  });
}

function list(app: FastifyInstance, token: string) {
  return app.inject({
    method: 'GET',
    url: '/v1/consents',
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('fluxo de consentimento (E2E via inject)', () => {
  it('paciente concede, lista, revoga e reconcede (reabre a mesma linha)', async () => {
    const harness = await buildTestHarness();
    const { token } = await setupPatient(harness);

    const granted = await grant(harness.app, token);
    expect(granted.statusCode).toBe(201);
    const consent = granted.json();
    expect(consent).toMatchObject({
      granteeProfessionalProfileId: GRANTEE,
      specialtyId: SPECIALTY,
      status: 'ACTIVE',
      revokedAt: null,
    });

    const listed = (await list(harness.app, token)).json();
    expect(listed.consents).toHaveLength(1);
    expect(listed.consents[0].id).toBe(consent.id);

    const revoked = await harness.app.inject({
      method: 'POST',
      url: `/v1/consents/${consent.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(revoked.statusCode).toBe(204);
    const afterRevoke = (await list(harness.app, token)).json();
    expect(afterRevoke.consents[0].status).toBe('REVOKED');
    expect(afterRevoke.consents[0].revokedAt).not.toBeNull();

    // Reconceder reabre a MESMA linha (mesmo id, ACTIVE de novo).
    const regranted = await grant(harness.app, token);
    expect(regranted.statusCode).toBe(201);
    expect(regranted.json().id).toBe(consent.id);
    expect(regranted.json().status).toBe('ACTIVE');
    const stillOne = (await list(harness.app, token)).json();
    expect(stillOne.consents).toHaveLength(1);

    await harness.app.close();
  });

  it('bloqueia consentimento duplicado ATIVO (409)', async () => {
    const harness = await buildTestHarness();
    const { token } = await setupPatient(harness);

    expect((await grant(harness.app, token)).statusCode).toBe(201);
    const dup = await grant(harness.app, token);
    expect(dup.statusCode).toBe(409);
    expect(dup.headers['content-type']).toContain('application/problem+json');

    await harness.app.close();
  });

  it('nega consentimento sem vinculo ativo na especialidade (422)', async () => {
    const harness = await buildTestHarness();
    const { token } = await setupPatient(harness, { withActiveBond: false });

    const denied = await grant(harness.app, token);
    expect(denied.statusCode).toBe(422);

    await harness.app.close();
  });

  it('nega consentimento a grantee inexistente (404)', async () => {
    const harness = await buildTestHarness();
    const { token } = await setupPatient(harness);

    const missing = await grant(harness.app, token, 'pp_inexistente');
    expect(missing.statusCode).toBe(404);

    await harness.app.close();
  });

  it('nega quem nao tem perfil de paciente (403) e sem token (401)', async () => {
    const harness = await buildTestHarness();

    // Conta registrada, mas sem perfil de paciente semeado no repo de consentimento.
    const res = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...patientPayload, email: 'outro@fitvo.dev', tenantName: 'Outro Solo' },
    });
    const outsiderToken = res.json().tokens.accessToken;
    harness.consent.seedProfessional(GRANTEE);

    const forbidden = await grant(harness.app, outsiderToken);
    expect(forbidden.statusCode).toBe(403);

    const unauthorized = await harness.app.inject({
      method: 'POST',
      url: '/v1/consents',
      payload: { granteeProfessionalProfileId: GRANTEE, specialtyId: SPECIALTY },
    });
    expect(unauthorized.statusCode).toBe(401);

    await harness.app.close();
  });

  it('revogar consentimento inexistente -> 404', async () => {
    const harness = await buildTestHarness();
    const { token } = await setupPatient(harness);

    const res = await harness.app.inject({
      method: 'POST',
      url: '/v1/consents/cons_inexistente/revoke',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);

    await harness.app.close();
  });

  it('valida o corpo do grant (campos ausentes -> 400)', async () => {
    const harness = await buildTestHarness();
    const { token } = await setupPatient(harness);

    const bad = await harness.app.inject({
      method: 'POST',
      url: '/v1/consents',
      headers: { authorization: `Bearer ${token}` },
      payload: { specialtyId: SPECIALTY },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().errors).toBeTruthy();

    await harness.app.close();
  });
});

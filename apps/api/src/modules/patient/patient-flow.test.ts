import { BOND_CREATED_EVENT, type BondCreatedEvent, SHARING_QUEUE } from '@fitvo/queue';
import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';
import { hashInviteToken } from '../clinic/invite-token';

const PRO_TENANT = 'pro_tenant_1';
const SPECIALTY = 'spec_training';

const proPayload = {
  email: 'pro@fitvo.dev',
  password: 'senha-forte-123',
  name: 'Profissional',
  document: '12345678901',
  documentType: 'CPF',
  tenantName: 'Estudio do Profissional (solo)',
};

/** Registra o profissional (via auth) e o semeia como profissional do tenant + especialidade. */
async function setupProfessional(
  harness: TestHarness,
): Promise<{ accountId: string; token: string; professionalProfileId: string }> {
  const res = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: proPayload,
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  const professionalProfileId = harness.patient.seedProfessional({
    accountId: body.account.id,
    tenantId: PRO_TENANT,
    specialtyIds: [SPECIALTY],
  });
  return { accountId: body.account.id, token: body.tokens.accessToken, professionalProfileId };
}

function createInvite(
  app: FastifyInstance,
  token: string,
  email: string,
  specialtyId = SPECIALTY,
  modality = 'ONLINE',
) {
  return app.inject({
    method: 'POST',
    url: `/v1/patients/${PRO_TENANT}/invites`,
    headers: { authorization: `Bearer ${token}` },
    payload: { email, specialtyId, modality },
  });
}

function accept(app: FastifyInstance, token: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/patients/invites/accept',
    payload: {
      token,
      password: 'senha-forte-456',
      name: 'Novo Paciente',
      document: '98765432100',
    },
  });
}

function overview(app: FastifyInstance, token: string) {
  return app.inject({
    method: 'GET',
    url: `/v1/patients/${PRO_TENANT}/overview`,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('fluxo de paciente e vinculo (E2E via inject)', () => {
  it('profissional convida, paciente aceita e o vinculo abre no ambiente da especialidade', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness);

    const invited = await createInvite(harness.app, pro.token, 'paciente@fitvo.dev');
    expect(invited.statusCode).toBe(201);
    const { invite, token } = invited.json();
    expect(invite.status).toBe('PENDING');
    expect(invite.email).toBe('paciente@fitvo.dev');
    expect(invite.specialtyId).toBe(SPECIALTY);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const accepted = await accept(harness.app, token);
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json()).toMatchObject({
      created: true,
      bond: { specialtyId: SPECIALTY },
      patient: { tenantId: PRO_TENANT },
    });

    const list = await overview(harness.app, pro.token);
    expect(list.statusCode).toBe(200);
    const { pendingInvites, activeBonds } = list.json();
    expect(pendingInvites).toHaveLength(0);
    expect(activeBonds).toHaveLength(1);
    expect(activeBonds[0]).toMatchObject({
      patientEmail: 'paciente@fitvo.dev',
      patientName: 'Novo Paciente',
      specialtyId: SPECIALTY,
      status: 'ACTIVE',
    });

    await harness.app.close();
  });

  it('o vinculo herda a modalidade declarada no convite pelo profissional (D-101)', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness);

    // O profissional declara PRESENCIAL — quem sabe como atende e ele; o
    // paciente nao escolhe a modalidade do servico que contrata (D-101).
    const invited = await createInvite(
      harness.app,
      pro.token,
      'presencial@fitvo.dev',
      SPECIALTY,
      'PRESENCIAL',
    );
    expect(invited.statusCode).toBe(201);
    expect(invited.json().invite.modality).toBe('PRESENCIAL');

    // O aceite nao recebe modalidade nenhuma: ela VIAJA no convite. E o que
    // permite o vinculo nascer com ela.
    const accepted = await accept(harness.app, invited.json().token);
    expect(accepted.statusCode).toBe(201);

    const { activeBonds } = (await overview(harness.app, pro.token)).json();
    expect(activeBonds[0]).toMatchObject({
      patientEmail: 'presencial@fitvo.dev',
      modality: 'PRESENCIAL',
    });

    await harness.app.close();
  });

  it('recusa convite sem modalidade: nenhum ADR elegeu um padrao (D-101)', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness);

    const semModalidade = await harness.app.inject({
      method: 'POST',
      url: `/v1/patients/${PRO_TENANT}/invites`,
      headers: { authorization: `Bearer ${pro.token}` },
      payload: { email: 'p@fitvo.dev', specialtyId: SPECIALTY },
    });
    expect(semModalidade.statusCode).toBe(400);

    const invalida = await createInvite(
      harness.app,
      pro.token,
      'p@fitvo.dev',
      SPECIALTY,
      'SEMIPRESENCIAL',
    );
    expect(invalida.statusCode).toBe(400);

    await harness.app.close();
  });

  it('publica o evento bond.created no aceite (alimenta o motor de compartilhamento — D-017)', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness);
    const { token } = (await createInvite(harness.app, pro.token, 'paciente@fitvo.dev')).json();
    const accepted = (await accept(harness.app, token)).json();

    const jobs = harness.queue.enqueuedJobs<BondCreatedEvent>(SHARING_QUEUE);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.name).toBe(BOND_CREATED_EVENT);
    expect(jobs[0]?.data).toMatchObject({
      patientProfileId: accepted.patient.patientProfileId,
      professionalProfileId: pro.professionalProfileId,
      specialtyId: SPECIALTY,
      tenantId: PRO_TENANT,
    });

    await harness.app.close();
  });

  it('nega convite a quem nao e profissional do tenant (403) e sem token (401)', async () => {
    const harness = await buildTestHarness();

    // Conta registrada, mas sem perfil profissional semeado no tenant alvo.
    const outsider = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...proPayload, email: 'outro@fitvo.dev', tenantName: 'Outro Solo' },
    });
    const outsiderToken = outsider.json().tokens.accessToken;

    const forbidden = await createInvite(harness.app, outsiderToken, 'paciente@fitvo.dev');
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.headers['content-type']).toContain('application/problem+json');

    const unauthorized = await harness.app.inject({
      method: 'POST',
      url: `/v1/patients/${PRO_TENANT}/invites`,
      // Body VALIDO de proposito: sem `modality` o schema da rota rejeitaria com
      // 400 antes do guard, e o teste passaria a provar a validacao em vez do 401.
      payload: { email: 'paciente@fitvo.dev', specialtyId: SPECIALTY, modality: 'ONLINE' },
    });
    expect(unauthorized.statusCode).toBe(401);

    await harness.app.close();
  });

  it('nega convite quando o profissional nao reivindica a especialidade (403) e para especialidade inexistente (404)', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness);

    // Especialidade existe no catalogo mas o profissional nao a reivindica.
    harness.patient.seedSpecialty('spec_nutrition');
    const notOwned = await createInvite(harness.app, pro.token, 'p@fitvo.dev', 'spec_nutrition');
    expect(notOwned.statusCode).toBe(403);

    // Especialidade fora do catalogo.
    const missing = await createInvite(harness.app, pro.token, 'p@fitvo.dev', 'spec_inexistente');
    expect(missing.statusCode).toBe(404);

    await harness.app.close();
  });

  it('bloqueia convite pendente duplicado para a mesma tripla (409)', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness);

    expect((await createInvite(harness.app, pro.token, 'paciente@fitvo.dev')).statusCode).toBe(201);
    const dup = await createInvite(harness.app, pro.token, 'paciente@fitvo.dev');
    expect(dup.statusCode).toBe(409);

    await harness.app.close();
  });

  it('reenvio rotaciona o token: o antigo falha (400) e o novo aceita (201) (D-055)', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness);

    const invited = await createInvite(harness.app, pro.token, 'paciente@fitvo.dev');
    const { invite, token: oldToken } = invited.json();

    const resent = await harness.app.inject({
      method: 'POST',
      url: `/v1/patients/${PRO_TENANT}/invites/${invite.id}/resend`,
      headers: { authorization: `Bearer ${pro.token}` },
    });
    expect(resent.statusCode).toBe(201);
    const newToken = resent.json().token;
    expect(newToken).not.toBe(oldToken);

    expect((await accept(harness.app, oldToken)).statusCode).toBe(400);
    expect((await accept(harness.app, newToken)).statusCode).toBe(201);

    // Reenviar convite inexistente -> 404.
    const missing = await harness.app.inject({
      method: 'POST',
      url: `/v1/patients/${PRO_TENANT}/invites/inv_inexistente/resend`,
      headers: { authorization: `Bearer ${pro.token}` },
    });
    expect(missing.statusCode).toBe(404);

    await harness.app.close();
  });

  it('revoga um convite pendente; o token revogado nao pode ser aceito', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness);

    const invited = await createInvite(harness.app, pro.token, 'paciente@fitvo.dev');
    const { invite, token } = invited.json();

    const revoked = await harness.app.inject({
      method: 'POST',
      url: `/v1/patients/${PRO_TENANT}/invites/${invite.id}/revoke`,
      headers: { authorization: `Bearer ${pro.token}` },
    });
    expect(revoked.statusCode).toBe(204);

    expect((await overview(harness.app, pro.token)).json().pendingInvites).toHaveLength(0);
    expect((await accept(harness.app, token)).statusCode).toBe(400);

    const missing = await harness.app.inject({
      method: 'POST',
      url: `/v1/patients/${PRO_TENANT}/invites/inv_inexistente/revoke`,
      headers: { authorization: `Bearer ${pro.token}` },
    });
    expect(missing.statusCode).toBe(404);

    await harness.app.close();
  });

  it('arquiva um vinculo ativo (D-053): sai da listagem e nao pode ser rearquivado', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness);

    const { token } = (await createInvite(harness.app, pro.token, 'paciente@fitvo.dev')).json();
    const bondId = (await accept(harness.app, token)).json().bond.id;

    const archived = await harness.app.inject({
      method: 'POST',
      url: `/v1/patients/${PRO_TENANT}/bonds/${bondId}/archive`,
      headers: { authorization: `Bearer ${pro.token}` },
    });
    expect(archived.statusCode).toBe(204);
    expect((await overview(harness.app, pro.token)).json().activeBonds).toHaveLength(0);

    const again = await harness.app.inject({
      method: 'POST',
      url: `/v1/patients/${PRO_TENANT}/bonds/${bondId}/archive`,
      headers: { authorization: `Bearer ${pro.token}` },
    });
    expect(again.statusCode).toBe(404);

    await harness.app.close();
  });

  it('aceite e de uso unico: reutilizar o mesmo token falha (400)', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness);
    const { token } = (await createInvite(harness.app, pro.token, 'paciente@fitvo.dev')).json();

    expect((await accept(harness.app, token)).statusCode).toBe(201);
    expect((await accept(harness.app, token)).statusCode).toBe(400);

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
    const proId = harness.patient.seedProfessional({
      accountId: 'acc_seed',
      tenantId: PRO_TENANT,
      specialtyIds: [SPECIALTY],
    });
    await harness.patient.createInvite({
      tenantId: PRO_TENANT,
      professionalProfileId: proId,
      specialtyId: SPECIALTY,
      email: 'exp@fitvo.dev',
      modality: 'ONLINE',
      tokenHash: hashInviteToken('raw-expirado'),
      expiresAt: new Date(Date.now() - 1_000),
    });
    const accepted = await accept(harness.app, 'raw-expirado');
    expect(accepted.statusCode).toBe(400);
    await harness.app.close();
  });

  it('valida o corpo do convite (e-mail invalido -> 400)', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness);
    const bad = await createInvite(harness.app, pro.token, 'nao-e-email');
    expect(bad.statusCode).toBe(400);
    expect(bad.json().errors).toBeTruthy();
    await harness.app.close();
  });
});

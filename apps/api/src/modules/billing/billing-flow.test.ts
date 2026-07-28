import { FakePaymentGateway } from '@fitvo/payments';
import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';
import { validProfessionalRegistration } from '../../testing/professional-registration-fixture';

const TENANT = 'tenant_solo';
const SUB_KEY = 'idem-subscription-0001';
const CHARGE_KEY = 'idem-charge-0001';

const proPayload = {
  ...validProfessionalRegistration,
  email: 'pro@fitvo.dev',
  name: 'Profissional Solo',
};

/**
 * Registra um profissional (via auth), marca o e-mail como verificado (D-029 —
 * emitir cobranca exige o gate) e arranja o mundo do billing no repo em
 * memoria: dono solo do tenant, plano com preco, subconta com taxa e um vinculo
 * ATIVO. Retorna o token do profissional e o id do vinculo.
 */
async function setup(
  harness: TestHarness,
): Promise<{ token: string; accountId: string; planId: string; bondId: string }> {
  const res = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: proPayload,
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  const accountId = body.account.id;
  await harness.accounts.markEmailVerified(accountId);
  const professionalProfileId = harness.billing.seedSoloProfessional(accountId, TENANT);
  const planId = harness.billing.seedPlan({
    code: 'solo',
    name: 'Solo',
    tier: 'solo',
    prices: [{ periodicity: 'MONTHLY', amountCents: 9900 }],
  });
  // Subconta com taxa de 5% (500 bp) — valor de EXEMPLO (a taxa comercial real e GATED).
  harness.billing.seedPaymentAccount(TENANT, {
    asaasWalletId: 'wallet_pro',
    feeBasisPoints: 500,
  });
  const bondId = harness.billing.seedActiveBond({ tenantId: TENANT, professionalProfileId });
  return { token: body.tokens.accessToken, accountId, planId, bondId };
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe('fluxo de billing (E2E via inject, FakePaymentGateway)', () => {
  it('catalogo publico de planos e acessivel sem token', async () => {
    const harness = await buildTestHarness();
    await setup(harness);
    const res = await harness.app.inject({ method: 'GET', url: '/v1/billing/plans' });
    expect(res.statusCode).toBe(200);
    expect(res.json().plans).toHaveLength(1);
    expect(res.json().plans[0]).toMatchObject({
      code: 'solo',
      prices: [{ periodicity: 'monthly', amountCents: 9900 }],
    });
    await harness.app.close();
  });

  it('assina (trial 7d), replay idempotente, bloqueia 2a assinatura e consulta', async () => {
    const harness = await buildTestHarness();
    const { token, planId } = await setup(harness);

    const subscribe = (idempotencyKey: string) =>
      harness.app.inject({
        method: 'POST',
        url: `/v1/billing/${TENANT}/subscription`,
        headers: auth(token),
        payload: { planId, periodicity: 'monthly', idempotencyKey },
      });

    const first = await subscribe(SUB_KEY);
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ status: 'TRIALING', periodicity: 'monthly' });
    expect(first.json().trialEndsAt).not.toBeNull();

    // Replay idempotente (mesma chave) -> mesma assinatura.
    const replay = await subscribe(SUB_KEY);
    expect(replay.statusCode).toBe(201);
    expect(replay.json().id).toBe(first.json().id);

    // Chave nova com assinatura vigente -> conflito (uma assinatura por tenant).
    const conflict = await subscribe('idem-subscription-0002');
    expect(conflict.statusCode).toBe(409);

    const current = await harness.app.inject({
      method: 'GET',
      url: `/v1/billing/${TENANT}/subscription`,
      headers: auth(token),
    });
    expect(current.statusCode).toBe(200);
    expect(current.json().id).toBe(first.json().id);

    await harness.app.close();
  });

  it('422 quando o plano nao tem preco para a periodicidade (catalogo GATED)', async () => {
    const harness = await buildTestHarness();
    const { token, planId } = await setup(harness);
    const res = await harness.app.inject({
      method: 'POST',
      url: `/v1/billing/${TENANT}/subscription`,
      headers: auth(token),
      payload: { planId, periodicity: 'annual', idempotencyKey: 'idem-annual-0001' },
    });
    expect(res.statusCode).toBe(422);
    await harness.app.close();
  });

  it('emite cobranca com taxa via split, replay idempotente e reflete na carteira', async () => {
    const harness = await buildTestHarness();
    const { token, bondId } = await setup(harness);

    const charge = (idempotencyKey: string) =>
      harness.app.inject({
        method: 'POST',
        url: `/v1/billing/${TENANT}/charges`,
        headers: auth(token),
        payload: { bondId, amountCents: 10_000, method: 'pix', idempotencyKey },
      });

    const created = await charge(CHARGE_KEY);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      amountCents: 10_000,
      method: 'pix',
      status: 'PENDING',
      platformFeeCents: 500, // 5% de R$100
    });

    // Replay idempotente.
    const replay = await charge(CHARGE_KEY);
    expect(replay.json().id).toBe(created.json().id);

    // Carteira: a cobranca pendente aparece em "a receber".
    const wallet = await harness.app.inject({
      method: 'GET',
      url: `/v1/billing/${TENANT}/wallet`,
      headers: auth(token),
    });
    expect(wallet.json()).toEqual({ receivedCents: 0, pendingCents: 10_000, feesCents: 0 });

    // Webhook Asaas move a cobranca para RECEBIDA; idempotente por evento.
    const asaasChargeId = (
      await new FakePaymentGateway().createCharge({
        customerId: 'x',
        amount: 10_000,
        method: 'pix',
        idempotencyKey: CHARGE_KEY,
      })
    ).id;
    const webhookPayload = {
      id: 'evt_pay_received_1',
      event: 'PAYMENT_RECEIVED',
      payment: { id: asaasChargeId },
    };
    const hook = (payload: Record<string, unknown>) =>
      harness.app.inject({ method: 'POST', url: '/v1/billing/webhooks/asaas', payload });

    const firstHook = await hook(webhookPayload);
    expect(firstHook.statusCode).toBe(200);
    expect(firstHook.json()).toEqual({ received: true, duplicate: false });

    // Reentrega do MESMO evento -> no-op idempotente.
    expect((await hook(webhookPayload)).json()).toEqual({ received: true, duplicate: true });

    const walletAfter = await harness.app.inject({
      method: 'GET',
      url: `/v1/billing/${TENANT}/wallet`,
      headers: auth(token),
    });
    expect(walletAfter.json()).toEqual({ receivedCents: 10_000, pendingCents: 0, feesCents: 500 });

    await harness.app.close();
  });

  it('gate de e-mail verificado (D-029): profissional nao verificado nao emite cobranca; verificado passa', async () => {
    const harness = await buildTestHarness();

    // Registra e arranja o mundo do billing SEM marcar o e-mail como verificado
    // (setup() faz isso; aqui reproduzimos so ate ali).
    const res = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: proPayload,
    });
    const body = res.json();
    const accountId = body.account.id;
    const professionalProfileId = harness.billing.seedSoloProfessional(accountId, TENANT);
    harness.billing.seedPaymentAccount(TENANT, {
      asaasWalletId: 'wallet_pro',
      feeBasisPoints: 500,
    });
    const bondId = harness.billing.seedActiveBond({ tenantId: TENANT, professionalProfileId });
    const token = body.tokens.accessToken;

    const blocked = await harness.app.inject({
      method: 'POST',
      url: `/v1/billing/${TENANT}/charges`,
      headers: auth(token),
      payload: { bondId, amountCents: 10_000, method: 'pix', idempotencyKey: 'idem-gate-0001' },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.headers['content-type']).toContain('application/problem+json');
    expect(blocked.json()).toMatchObject({
      type: 'https://fitvo.dev/problems/email-not-verified',
    });

    await harness.accounts.markEmailVerified(accountId);
    const created = await harness.app.inject({
      method: 'POST',
      url: `/v1/billing/${TENANT}/charges`,
      headers: auth(token),
      payload: { bondId, amountCents: 10_000, method: 'pix', idempotencyKey: 'idem-gate-0001' },
    });
    expect(created.statusCode).toBe(201);

    await harness.app.close();
  });

  it('guards: sem token 401, nao-dono 403 no Fluxo A, nao-profissional 403 na cobranca', async () => {
    const harness = await buildTestHarness();
    const { planId } = await setup(harness);

    // Outra conta, sem papel neste tenant.
    const outsider = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...proPayload, email: 'outro@fitvo.dev' },
    });
    const outsiderToken = outsider.json().tokens.accessToken;

    const noToken = await harness.app.inject({
      method: 'GET',
      url: `/v1/billing/${TENANT}/subscription`,
    });
    expect(noToken.statusCode).toBe(401);

    const forbiddenSub = await harness.app.inject({
      method: 'POST',
      url: `/v1/billing/${TENANT}/subscription`,
      headers: auth(outsiderToken),
      payload: { planId, periodicity: 'monthly', idempotencyKey: 'idem-x-0001' },
    });
    expect(forbiddenSub.statusCode).toBe(403);

    const forbiddenCharge = await harness.app.inject({
      method: 'POST',
      url: `/v1/billing/${TENANT}/charges`,
      headers: auth(outsiderToken),
      payload: {
        bondId: 'bond_x',
        amountCents: 1000,
        method: 'pix',
        idempotencyKey: 'idem-y-0001',
      },
    });
    expect(forbiddenCharge.statusCode).toBe(403);

    await harness.app.close();
  });

  it('valida o corpo da cobranca (amountCents nao-inteiro/negativo -> 400)', async () => {
    const harness = await buildTestHarness();
    const { token, bondId } = await setup(harness);
    const bad = await harness.app.inject({
      method: 'POST',
      url: `/v1/billing/${TENANT}/charges`,
      headers: auth(token),
      payload: { bondId, amountCents: -5, method: 'pix', idempotencyKey: 'idem-neg-0001' },
    });
    expect(bad.statusCode).toBe(400);
    await harness.app.close();
  });
});

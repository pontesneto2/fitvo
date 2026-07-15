import { describe, expect, it, vi } from 'vitest';

import {
  AsaasPaymentGateway,
  buildChargeSplits,
  computePlatformFeeCents,
  FakePaymentGateway,
  type HttpClient,
  normalizeAsaasStatus,
} from './index';

describe('computePlatformFeeCents', () => {
  it('calcula a taxa em centavos inteiros a partir de basis points', () => {
    expect(computePlatformFeeCents(10_000, 500)).toBe(500); // 5% de R$100 = R$5
    expect(computePlatformFeeCents(9_999, 250)).toBe(250); // arredonda ao centavo
    expect(computePlatformFeeCents(10_000, 0)).toBe(0);
    expect(computePlatformFeeCents(0, 500)).toBe(0);
  });
});

describe('buildChargeSplits', () => {
  it('emite um split de valor fixo para a wallet do FITVO quando ha taxa e wallet', () => {
    const splits = buildChargeSplits({
      professionalWalletId: 'wallet_pro',
      platformWalletId: 'wallet_fitvo',
      platformFeeCents: 500,
    });
    expect(splits).toEqual([{ walletId: 'wallet_fitvo', fixedAmount: 500 }]);
  });

  it('nao emite split sem wallet da plataforma (GATED) nem com taxa zero', () => {
    expect(
      buildChargeSplits({
        professionalWalletId: 'w',
        platformWalletId: null,
        platformFeeCents: 500,
      }),
    ).toEqual([]);
    expect(
      buildChargeSplits({ professionalWalletId: 'w', platformWalletId: 'f', platformFeeCents: 0 }),
    ).toEqual([]);
  });
});

describe('normalizeAsaasStatus', () => {
  it('mapeia status do Asaas para o dominio, com fallback conservador', () => {
    expect(normalizeAsaasStatus('RECEIVED')).toBe('received');
    expect(normalizeAsaasStatus('CONFIRMED')).toBe('confirmed');
    expect(normalizeAsaasStatus('OVERDUE')).toBe('overdue');
    expect(normalizeAsaasStatus('REFUNDED')).toBe('refunded');
    expect(normalizeAsaasStatus('PENDING')).toBe('pending');
    expect(normalizeAsaasStatus('QUALQUER_COISA')).toBe('failed');
  });
});

describe('FakePaymentGateway', () => {
  it('e idempotente por idempotencyKey na cobranca', async () => {
    const gw = new FakePaymentGateway();
    const input = {
      customerId: 'cus_1',
      amount: 10_000,
      method: 'pix' as const,
      idempotencyKey: 'key-1',
    };
    const a = await gw.createCharge(input);
    const b = await gw.createCharge(input);
    expect(a.id).toBe(b.id);
    expect(a.amount).toBe(10_000);
    expect(a.status).toBe('pending');
  });

  it('e idempotente por idempotencyKey na assinatura', async () => {
    const gw = new FakePaymentGateway();
    const input = {
      customerId: 'cus_1',
      amount: 5_000,
      periodicity: 'monthly' as const,
      idempotencyKey: 'sub-1',
    };
    const a = await gw.createSubscription(input);
    const b = await gw.createSubscription(input);
    expect(a.id).toBe(b.id);
    expect(a.status).toBe('active');
  });

  it('normaliza webhook e extrai o chargeId aninhado', async () => {
    const gw = new FakePaymentGateway();
    const event = await gw.parseWebhook(
      { id: 'evt_1', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } },
      'sig-ignorada',
    );
    expect(event).toMatchObject({ id: 'evt_1', type: 'PAYMENT_RECEIVED', chargeId: 'pay_1' });
  });
});

describe('AsaasPaymentGateway (HTTP mockado — LIVE gated)', () => {
  const config = {
    apiKey: 'placeholder-key',
    baseUrl: 'https://sandbox.asaas.com/api/v3',
    webhookSecret: 'top-secret',
  };

  it('monta o payload da cobranca (centavos->reais), passa a idempotencyKey e o split', async () => {
    const calls: { url: string; body: unknown; headers: Record<string, string> }[] = [];
    const http: HttpClient = (url, init) => {
      calls.push({ url, body: JSON.parse(init.body ?? '{}'), headers: init.headers });
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ id: 'pay_x', status: 'PENDING' }),
      });
    };
    const gw = new AsaasPaymentGateway(config, http);
    const charge = await gw.createCharge({
      customerId: 'cus_9',
      amount: 10_000,
      method: 'boleto',
      idempotencyKey: 'idem-9',
      splits: [{ walletId: 'wallet_fitvo', fixedAmount: 500 }],
    });

    expect(charge).toMatchObject({
      id: 'pay_x',
      status: 'pending',
      amount: 10_000,
      method: 'boleto',
    });
    const [call] = calls;
    expect(call?.url).toBe('https://sandbox.asaas.com/api/v3/payments');
    expect(call?.headers['idempotency-key']).toBe('idem-9');
    expect(call?.headers.access_token).toBe('placeholder-key');
    expect(call?.body).toMatchObject({
      customer: 'cus_9',
      billingType: 'BOLETO',
      value: 100, // 10000 centavos -> R$100,00
      externalReference: 'idem-9',
      split: [{ walletId: 'wallet_fitvo', fixedValue: 5 }],
    });
  });

  it('valida a assinatura do webhook (aceita o segredo correto, rejeita o errado)', async () => {
    const gw = new AsaasPaymentGateway(config);
    const event = await gw.parseWebhook(
      { id: 'evt_2', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_2' } },
      'top-secret',
    );
    expect(event.chargeId).toBe('pay_2');
    await expect(
      gw.parseWebhook({ id: 'evt_3', event: 'X', payment: {} }, 'assinatura-errada'),
    ).rejects.toThrow(/Assinatura/);
  });

  it('lanca em resposta HTTP de erro do Asaas', async () => {
    const http: HttpClient = () =>
      Promise.resolve({ status: 401, json: () => Promise.resolve({}) });
    const gw = new AsaasPaymentGateway(config, http);
    await expect(
      gw.createCharge({ customerId: 'c', amount: 1, method: 'pix', idempotencyKey: 'k' }),
    ).rejects.toThrow(/401/);
  });

  it('nao usa a rede real nos testes (fetch nao e chamado quando o http e injetado)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const http: HttpClient = () =>
      Promise.resolve({ status: 200, json: () => Promise.resolve({ id: 's', status: 'ACTIVE' }) });
    const gw = new AsaasPaymentGateway(config, http);
    await gw.createSubscription({
      customerId: 'c',
      amount: 1,
      periodicity: 'annual',
      idempotencyKey: 'k2',
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

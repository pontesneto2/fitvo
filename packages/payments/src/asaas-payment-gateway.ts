import { timingSafeEqual } from 'node:crypto';

import type {
  Charge,
  ChargeMethod,
  ChargeStatus,
  CreateChargeInput,
  CreateSubscriptionInput,
  PaymentGateway,
  PaymentWebhookEvent,
  Refund,
  Subscription,
} from './index';

/** Configuracao do adaptador Asaas. Todos os segredos vem do ambiente (D-070). */
export interface AsaasConfig {
  apiKey: string;
  baseUrl: string;
  /** Segredo do webhook (Asaas envia no header `asaas-access-token`). */
  webhookSecret: string;
}

/** Cliente HTTP minimo — injetavel para teste sem rede real. */
export type HttpClient = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; json: () => Promise<unknown> }>;

/** Mapeia o metodo do dominio para o `billingType` do Asaas. */
const BILLING_TYPE: Record<ChargeMethod, string> = {
  boleto: 'BOLETO',
  pix: 'PIX',
  credit_card: 'CREDIT_CARD',
};

/** Ciclo de recorrencia do Asaas por periodicidade. */
const ASAAS_CYCLE: Record<string, string> = {
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
  biannual: 'SEMIANNUALLY',
  annual: 'YEARLY',
};

/**
 * Normaliza o status de pagamento do Asaas para o ChargeStatus do dominio.
 * Eventos/status conhecidos do Asaas (PAYMENT_*); qualquer desconhecido cai em
 * `failed` de forma conservadora (nunca marca recebido sem confirmacao).
 */
export function normalizeAsaasStatus(asaasStatus: string): ChargeStatus {
  switch (asaasStatus) {
    case 'PENDING':
    case 'AWAITING_RISK_ANALYSIS':
      return 'pending';
    case 'CONFIRMED':
      return 'confirmed';
    case 'RECEIVED':
    case 'RECEIVED_IN_CASH':
      return 'received';
    case 'OVERDUE':
      return 'overdue';
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
      return 'refunded';
    default:
      return 'failed';
  }
}

/**
 * Adaptador do gateway Asaas (D-028/D-050 — ADR-0004). Estrutura HTTP REAL
 * (base URL + api key por config), montagem de split e validacao de assinatura
 * de webhook. LIVE GATED: sem credenciais Asaas neste repo publico, este
 * adaptador NAO e exercitado contra a API real — o teste de sandbox e uma
 * pendencia (requer credenciais reais, corretamente ausentes). A DI de dev/teste
 * cai para o FakePaymentGateway quando `ASAAS_API_KEY` nao esta setado.
 *
 * A logica pura (montagem de payload/split, normalizacao de status, parse de
 * webhook + assinatura) e testavel com um HttpClient mockado; nenhuma chamada
 * de rede acontece nos testes.
 */
export class AsaasPaymentGateway implements PaymentGateway {
  constructor(
    private readonly config: AsaasConfig,
    private readonly http: HttpClient = defaultHttpClient,
  ) {}

  async createCharge(input: CreateChargeInput): Promise<Charge> {
    const body: Record<string, unknown> = {
      customer: input.customerId,
      billingType: BILLING_TYPE[input.method],
      value: input.amount / 100, // Asaas usa reais decimais; o dominio guarda centavos (D-069)
      description: input.description,
      externalReference: input.idempotencyKey,
      dueDate: input.dueDate ? isoDate(input.dueDate) : undefined,
    };
    if (input.splits && input.splits.length > 0) {
      body.split = input.splits.map((rule) => ({
        walletId: rule.walletId,
        percentualValue: rule.percentage,
        fixedValue: rule.fixedAmount !== undefined ? rule.fixedAmount / 100 : undefined,
      }));
    }
    const data = await this.post('/payments', input.idempotencyKey, body);
    return {
      id: stringField(data, 'id'),
      status: normalizeAsaasStatus(stringField(data, 'status')),
      amount: input.amount,
      method: input.method,
    };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    const body: Record<string, unknown> = {
      customer: input.customerId,
      billingType: 'UNDEFINED',
      value: input.amount / 100,
      cycle: ASAAS_CYCLE[input.periodicity] ?? 'MONTHLY',
      externalReference: input.idempotencyKey,
    };
    if (input.splits && input.splits.length > 0) {
      body.split = input.splits.map((rule) => ({
        walletId: rule.walletId,
        percentualValue: rule.percentage,
        fixedValue: rule.fixedAmount !== undefined ? rule.fixedAmount / 100 : undefined,
      }));
    }
    const data = await this.post('/subscriptions', input.idempotencyKey, body);
    return {
      id: stringField(data, 'id'),
      status: 'active',
      amount: input.amount,
      periodicity: input.periodicity,
    };
  }

  async refund(chargeId: string, input?: { amount?: number }): Promise<Refund> {
    // Reembolso voluntario (D-025). A POLITICA juridica de estorno/arrependimento
    // (CDC) e GATED (advogado — ADR-0004): o adaptador so aciona o gateway.
    const body = input?.amount !== undefined ? { value: input.amount / 100 } : {};
    const data = await this.post(`/payments/${chargeId}/refund`, `refund:${chargeId}`, body);
    return { id: stringField(data, 'id'), chargeId, amount: input?.amount ?? 0 };
  }

  // `async` de proposito: uma assinatura invalida vira uma REJEICAO (nao um throw
  // sincrono), para que o chamador trate sempre pela via de Promise.
  async parseWebhook(payload: unknown, signature: string): Promise<PaymentWebhookEvent> {
    // Valida a assinatura do webhook: o Asaas envia o token configurado no header
    // `asaas-access-token`. Comparacao em tempo constante (evita timing attack).
    if (!verifySignature(this.config.webhookSecret, signature)) {
      throw new Error('Assinatura de webhook Asaas invalida.');
    }
    const raw = (payload ?? {}) as Record<string, unknown>;
    const nested = (raw.payment ?? {}) as Record<string, unknown>;
    const event: PaymentWebhookEvent = {
      id: typeof raw.id === 'string' ? raw.id : String(nested.id ?? ''),
      type: typeof raw.event === 'string' ? raw.event : 'UNKNOWN',
      raw,
    };
    if (typeof nested.id === 'string') {
      event.chargeId = nested.id;
    }
    return event;
  }

  private async post(
    path: string,
    idempotencyKey: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await this.http(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: this.config.apiKey,
        // Idempotencia no lado do Asaas (alem da nossa chave persistida — D-035).
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    if (response.status >= 400) {
      throw new Error(`Asaas respondeu ${response.status} em ${path}.`);
    }
    return (await response.json()) as Record<string, unknown>;
  }
}

function stringField(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === 'string' ? value : '';
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function verifySignature(secret: string, signature: string): boolean {
  if (!secret || !signature) {
    return false;
  }
  const a = Buffer.from(secret);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cliente HTTP padrao sobre o `fetch` global (Node >= 20). */
const defaultHttpClient: HttpClient = async (url, init) => {
  const response = await fetch(url, init);
  return { status: response.status, json: () => response.json() };
};

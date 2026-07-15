import { createHash } from 'node:crypto';

import type {
  Charge,
  CreateChargeInput,
  CreateSubscriptionInput,
  PaymentGateway,
  PaymentWebhookEvent,
  Refund,
  Subscription,
} from './index';

/** Id deterministico derivado de um prefixo + chave (idempotencia previsivel). */
function deterministicId(prefix: string, key: string): string {
  return `${prefix}_${createHash('sha256').update(key).digest('hex').slice(0, 24)}`;
}

/**
 * Gateway de pagamento FALSO, em memoria e DETERMINISTICO (sem rede). E o
 * fallback quando o Asaas nao esta configurado (sem credenciais neste repo
 * publico — ADR-0004) e o gateway usado nos testes. Idempotente por design: a
 * mesma `idempotencyKey` sempre devolve a mesma cobranca/assinatura (D-035).
 *
 * NAO fabrica credenciais nem chama a API real — apenas modela o contrato de
 * forma previsivel para que a slice de billing e a regua do worker sejam
 * exercitaveis ponta a ponta sem infraestrutura de pagamento.
 */
export class FakePaymentGateway implements PaymentGateway {
  private readonly charges = new Map<string, Charge>();
  private readonly subscriptions = new Map<string, Subscription>();

  createCharge(input: CreateChargeInput): Promise<Charge> {
    const existing = this.charges.get(input.idempotencyKey);
    if (existing) {
      return Promise.resolve(existing);
    }
    const charge: Charge = {
      id: deterministicId('fake_chg', input.idempotencyKey),
      status: 'pending',
      amount: input.amount,
      method: input.method,
    };
    this.charges.set(input.idempotencyKey, charge);
    return Promise.resolve(charge);
  }

  createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    const existing = this.subscriptions.get(input.idempotencyKey);
    if (existing) {
      return Promise.resolve(existing);
    }
    const subscription: Subscription = {
      id: deterministicId('fake_sub', input.idempotencyKey),
      status: 'active',
      amount: input.amount,
      periodicity: input.periodicity,
    };
    this.subscriptions.set(input.idempotencyKey, subscription);
    return Promise.resolve(subscription);
  }

  refund(chargeId: string, input?: { amount?: number }): Promise<Refund> {
    // Reembolso voluntario (D-025). A POLITICA juridica (CDC/arrependimento) e
    // GATED (advogado — ADR-0004): aqui so devolvemos o contrato, sem regra.
    return Promise.resolve({
      id: deterministicId('fake_ref', chargeId),
      chargeId,
      amount: input?.amount ?? 0,
    });
  }

  parseWebhook(payload: unknown, _signature: string): Promise<PaymentWebhookEvent> {
    // O Fake nao valida assinatura (nao ha segredo). Normaliza o payload de forma
    // tolerante para os testes do ledger de idempotencia e da maquina de status.
    const raw = (payload ?? {}) as Record<string, unknown>;
    const id =
      typeof raw.id === 'string' ? raw.id : deterministicId('fake_evt', JSON.stringify(raw));
    const type = typeof raw.event === 'string' ? raw.event : 'UNKNOWN';
    const nested = (raw.payment ?? {}) as Record<string, unknown>;
    const event: PaymentWebhookEvent = { id, type, raw };
    if (typeof nested.id === 'string') {
      event.chargeId = nested.id;
    }
    return Promise.resolve(event);
  }
}

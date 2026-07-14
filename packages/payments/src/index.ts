/**
 * @fitvo/payments — contrato do gateway de pagamento (D-028): cobranca,
 * recorrencia, split, reembolso e webhook. Interfaces apenas; o adaptador
 * Asaas e Fase posterior. Dinheiro SEMPRE em centavos inteiros (D-069).
 */

/** Valor monetario em centavos (inteiro). Nunca usar float (D-069). */
export type Cents = number;

export type ChargeMethod = 'boleto' | 'pix' | 'credit_card';
export type ChargeStatus = 'pending' | 'confirmed' | 'received' | 'overdue' | 'refunded' | 'failed';

/** Regra de split: parte destinada a uma subconta (D-018/D-050). */
export interface SplitRule {
  walletId: string;
  percentage?: number;
  fixedAmount?: Cents;
}

export interface CreateChargeInput {
  customerId: string;
  amount: Cents;
  method: ChargeMethod;
  description?: string;
  dueDate?: Date;
  splits?: SplitRule[];
  /** Idempotencia obrigatoria em operacoes financeiras (D-035). */
  idempotencyKey: string;
}

export interface Charge {
  id: string;
  status: ChargeStatus;
  amount: Cents;
  method: ChargeMethod;
}

export type Periodicity = 'monthly' | 'quarterly' | 'biannual' | 'annual';

export interface CreateSubscriptionInput {
  customerId: string;
  amount: Cents;
  periodicity: Periodicity;
  splits?: SplitRule[];
  idempotencyKey: string;
}

export interface Subscription {
  id: string;
  status: 'active' | 'inactive' | 'canceled';
  amount: Cents;
  periodicity: Periodicity;
}

export interface Refund {
  id: string;
  chargeId: string;
  amount: Cents;
}

export interface PaymentWebhookEvent {
  id: string;
  type: string;
  chargeId?: string;
  raw: unknown;
}

export interface PaymentGateway {
  createCharge(input: CreateChargeInput): Promise<Charge>;
  createSubscription(input: CreateSubscriptionInput): Promise<Subscription>;
  refund(chargeId: string, input?: { amount?: Cents }): Promise<Refund>;
  /** Valida assinatura do webhook e devolve o evento normalizado. */
  parseWebhook(payload: unknown, signature: string): Promise<PaymentWebhookEvent>;
}

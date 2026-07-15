import type {
  ChargeMethod as DbChargeMethod,
  ChargeStatus as DbChargeStatus,
  Periodicity as DbPeriodicity,
} from '@fitvo/database';
import {
  buildChargeSplits,
  type ChargeMethod as GatewayChargeMethod,
  type ChargeStatus as GatewayChargeStatus,
  computePlatformFeeCents,
  type PaymentGateway,
  type Periodicity as GatewayPeriodicity,
} from '@fitvo/payments';

import type { AccessTokenVerifier } from '../../shared/auth-context';
import { requireAuth } from '../../shared/auth-context';
import {
  ForbiddenError,
  NotFoundError,
  PlanNotFoundError,
  PlanPriceUnavailableError,
  SubscriptionAlreadyExistsError,
} from '../../shared/http-errors';
import type {
  BillingRepository,
  ChargeRecord,
  PlanRecord,
  SubscriptionRecord,
  WalletSummary,
} from './billing-repository';

/** Trial de 7 dias antes de cobrar (D-062). Fixo por ADR; nao inventado. */
const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Periodicidade lower (API/gateway) -> enum do banco. */
const API_PERIODICITY: Record<GatewayPeriodicity, DbPeriodicity> = {
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
  biannual: 'BIANNUAL',
  annual: 'ANNUAL',
};
const DB_PERIODICITY: Record<DbPeriodicity, GatewayPeriodicity> = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  BIANNUAL: 'biannual',
  ANNUAL: 'annual',
};
/** Meses por periodicidade — base do currentPeriodEnd (Fluxo A). */
const PERIODICITY_MONTHS: Record<DbPeriodicity, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  BIANNUAL: 6,
  ANNUAL: 12,
};

const API_METHOD: Record<GatewayChargeMethod, DbChargeMethod> = {
  boleto: 'BOLETO',
  pix: 'PIX',
  credit_card: 'CREDIT_CARD',
};
const GATEWAY_STATUS_TO_DB: Record<GatewayChargeStatus, DbChargeStatus> = {
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  received: 'RECEIVED',
  overdue: 'OVERDUE',
  refunded: 'REFUNDED',
  failed: 'FAILED',
};

/** Mapa evento Asaas -> status de cobranca (D-020). Conservador por padrao. */
const WEBHOOK_TYPE_TO_STATUS: Record<string, DbChargeStatus> = {
  PAYMENT_CREATED: 'PENDING',
  PAYMENT_CONFIRMED: 'CONFIRMED',
  PAYMENT_RECEIVED: 'RECEIVED',
  PAYMENT_OVERDUE: 'OVERDUE',
  PAYMENT_REFUNDED: 'REFUNDED',
  PAYMENT_DELETED: 'FAILED',
};

export interface PlanView {
  id: string;
  code: string;
  name: string;
  tier: string;
  prices: { periodicity: GatewayPeriodicity; amountCents: number }[];
}

export interface SubscriptionView {
  id: string;
  planId: string;
  periodicity: GatewayPeriodicity;
  status: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
}

export interface ChargeView {
  id: string;
  bondId: string;
  amountCents: number;
  method: GatewayChargeMethod;
  status: string;
  recurring: boolean;
  periodicity: GatewayPeriodicity | null;
  platformFeeCents: number;
  createdAt: string;
}

export interface WalletView {
  receivedCents: number;
  pendingCents: number;
  feesCents: number;
}

export interface SubscribeInput {
  planId: string;
  periodicity: GatewayPeriodicity;
  idempotencyKey: string;
}

export interface CreateChargeInput {
  bondId: string;
  amountCents: number;
  method: GatewayChargeMethod;
  idempotencyKey: string;
  // `| undefined` explicito: casa a saida do Zod (`.optional()`) sob
  // exactOptionalPropertyTypes, sem forcar o handler a remontar o objeto.
  description?: string | undefined;
  dueDate?: string | undefined;
  recurring?: boolean | undefined;
  periodicity?: GatewayPeriodicity | undefined;
}

export interface WebhookResult {
  received: true;
  duplicate: boolean;
}

function toPlanView(plan: PlanRecord): PlanView {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    tier: plan.tier,
    prices: plan.prices.map((price) => ({
      periodicity: DB_PERIODICITY[price.periodicity],
      amountCents: price.amountCents,
    })),
  };
}

function toSubscriptionView(sub: SubscriptionRecord): SubscriptionView {
  return {
    id: sub.id,
    planId: sub.planId,
    periodicity: DB_PERIODICITY[sub.periodicity],
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
    trialEndsAt: sub.trialEndsAt ? sub.trialEndsAt.toISOString() : null,
  };
}

function toChargeView(charge: ChargeRecord): ChargeView {
  return {
    id: charge.id,
    bondId: charge.bondId,
    amountCents: charge.amountCents,
    method: charge.method.toLowerCase() as GatewayChargeMethod,
    status: charge.status,
    recurring: charge.recurring,
    periodicity: charge.periodicity ? DB_PERIODICITY[charge.periodicity] : null,
    platformFeeCents: charge.platformFeeCents,
    createdAt: charge.createdAt.toISOString(),
  };
}

function toWalletView(summary: WalletSummary): WalletView {
  return {
    receivedCents: summary.receivedCents,
    pendingCents: summary.pendingCents,
    feesCents: summary.feesCents,
  };
}

/**
 * Servico de aplicacao do dominio Financeiro (ADR-0004). Dois fluxos:
 * - Fluxo A (assinatura tenant->FITVO): catalogo publico, assinar plano, ver
 *   assinatura vigente. Guard = dono/admin do tenant.
 * - Fluxo B (paciente->profissional via split): profissional emite cobranca
 *   contra um vinculo; a taxa da FITVO e capturada como dado e desviada por
 *   split. Guard = profissional dono do vinculo.
 * - Webhook (publico): normaliza o evento pelo gateway, dedupe idempotente
 *   (D-035) e atualiza status de cobranca/assinatura.
 *
 * Dinheiro sempre em centavos inteiros (D-069). Idempotencia obrigatoria em toda
 * operacao financeira (D-035): a idempotencyKey do cliente e unica e um replay
 * devolve o registro existente. O gateway LIVE (Asaas) e GATED — na ausencia de
 * credenciais a DI injeta o FakePaymentGateway (deterministico).
 */
export class BillingApplicationService {
  constructor(
    private readonly billing: BillingRepository,
    private readonly gateway: PaymentGateway,
    private readonly tokenVerifier: AccessTokenVerifier,
    /** Wallet do FITVO para o split da taxa (config — GATED; pode faltar). */
    private readonly platformWalletId: string | null,
  ) {}

  /** Catalogo publico de planos Nivel 1 (D-060). Precos comerciais reais GATED. */
  async listPlans(): Promise<PlanView[]> {
    const plans = await this.billing.listActivePlans();
    return plans.map(toPlanView);
  }

  /** Dono/admin do tenant assina um plano (Fluxo A — D-062). Idempotente (D-035). */
  async subscribe(
    authorization: string | undefined,
    tenantId: string,
    input: SubscribeInput,
  ): Promise<SubscriptionView> {
    await this.requireTenantOwnerOrAdmin(authorization, tenantId);

    // Replay idempotente: a MESMA chave devolve a assinatura ja criada.
    const replay = await this.billing.findSubscriptionByIdempotencyKey(input.idempotencyKey);
    if (replay) {
      return toSubscriptionView(replay);
    }

    // Uma assinatura NAO-terminal por tenant (default documentado).
    const current = await this.billing.findCurrentSubscription(tenantId);
    if (current) {
      throw new SubscriptionAlreadyExistsError();
    }

    const plan = await this.billing.findPlan(input.planId);
    if (!plan || !plan.active) {
      throw new PlanNotFoundError();
    }
    const dbPeriodicity = API_PERIODICITY[input.periodicity];
    const price = plan.prices.find((row) => row.periodicity === dbPeriodicity);
    if (!price) {
      // Sem preco configurado: catalogo comercial ainda nao populado (GATED).
      throw new PlanPriceUnavailableError();
    }

    const now = Date.now();
    const trialEndsAt = new Date(now + TRIAL_DAYS * DAY_MS);
    const currentPeriodEnd = addMonths(trialEndsAt, PERIODICITY_MONTHS[dbPeriodicity]);

    // customerId no gateway = tenantId (placeholder). O id de cliente Asaas real
    // vem do onboarding da subconta — GATED. O Fake apenas ecoa o valor.
    const gatewaySub = await this.gateway.createSubscription({
      customerId: tenantId,
      amount: price.amountCents,
      periodicity: input.periodicity,
      idempotencyKey: input.idempotencyKey,
    });

    const created = await this.billing.createSubscription({
      tenantId,
      planId: plan.id,
      periodicity: dbPeriodicity,
      status: 'TRIALING',
      asaasSubscriptionId: gatewaySub.id || null,
      idempotencyKey: input.idempotencyKey,
      currentPeriodEnd,
      trialEndsAt,
    });
    return toSubscriptionView(created);
  }

  /** Assinatura vigente do tenant (Fluxo A). 404 se nao houver. */
  async getSubscription(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<SubscriptionView> {
    await this.requireTenantOwnerOrAdmin(authorization, tenantId);
    const current = await this.billing.findCurrentSubscription(tenantId);
    if (!current) {
      throw new NotFoundError('Nenhuma assinatura vigente para este tenant.');
    }
    return toSubscriptionView(current);
  }

  /**
   * Profissional emite uma cobranca contra um vinculo seu (Fluxo B — D-019).
   * Monta o split (subconta do profissional + taxa da FITVO), idempotente (D-035).
   */
  async createCharge(
    authorization: string | undefined,
    tenantId: string,
    input: CreateChargeInput,
  ): Promise<ChargeView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);

    const bond = await this.billing.findActiveBondForProfessional(
      tenantId,
      professionalProfileId,
      input.bondId,
    );
    if (!bond) {
      throw new NotFoundError('Vinculo ativo nao encontrado para este profissional.');
    }

    // Replay idempotente.
    const replay = await this.billing.findChargeByIdempotencyKey(input.idempotencyKey);
    if (replay) {
      return toChargeView(replay);
    }

    // Subconta + taxa do tenant. Sem PaymentAccount (onboarding pendente — GATED):
    // walletId nulo e taxa 0; a cobranca ainda e criada e a conciliacao real fica
    // para o onboarding LIVE da subconta. Documentado.
    const account = await this.billing.findPaymentAccount(tenantId);
    const professionalWalletId = account?.asaasWalletId ?? null;
    const feeBasisPoints = account?.feeBasisPoints ?? 0;
    const platformFeeCents = computePlatformFeeCents(input.amountCents, feeBasisPoints);
    const splits = buildChargeSplits({
      professionalWalletId,
      platformWalletId: this.platformWalletId,
      platformFeeCents,
    });

    const dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
    // customerId no gateway = patientProfileId (placeholder — id de cliente Asaas
    // real vem do onboarding do paciente, GATED).
    const gatewayCharge = await this.gateway.createCharge({
      customerId: bond.patientProfileId,
      amount: input.amountCents,
      method: input.method,
      idempotencyKey: input.idempotencyKey,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(splits.length > 0 ? { splits } : {}),
    });

    const created = await this.billing.createCharge({
      tenantId,
      bondId: bond.bondId,
      amountCents: input.amountCents,
      method: API_METHOD[input.method],
      status: GATEWAY_STATUS_TO_DB[gatewayCharge.status],
      recurring: input.recurring ?? false,
      periodicity: input.periodicity ? API_PERIODICITY[input.periodicity] : null,
      asaasChargeId: gatewayCharge.id || null,
      idempotencyKey: input.idempotencyKey,
      professionalWalletId,
      platformFeeCents,
      description: input.description ?? null,
      dueDate: dueDate ?? null,
    });
    return toChargeView(created);
  }

  /** Extrato da carteira do tenant: recebido / a receber / taxas (D-061). */
  async getWallet(authorization: string | undefined, tenantId: string): Promise<WalletView> {
    await this.requireTenantOwnerOrAdmin(authorization, tenantId);
    return toWalletView(await this.billing.walletSummary(tenantId));
  }

  /**
   * Webhook Asaas (publico). Valida a assinatura via gateway, dedupe idempotente
   * pelo ledger (D-035) e atualiza status de cobranca/assinatura. Um evento
   * reentregue e no-op (duplicate=true).
   */
  async handleWebhook(payload: unknown, signature: string): Promise<WebhookResult> {
    const event = await this.gateway.parseWebhook(payload, signature);
    const isNew = await this.billing.recordWebhookEvent(event.id, event.type, payload);
    if (!isNew) {
      return { received: true, duplicate: true };
    }
    const status = WEBHOOK_TYPE_TO_STATUS[event.type];
    if (status && event.chargeId) {
      await this.billing.updateChargeStatusByAsaasId(event.chargeId, status);
    }
    // TODO(ADR-0004): mapear eventos de assinatura (SUBSCRIPTION_*) para
    // SubscriptionStatus quando o fluxo LIVE de assinatura Asaas for habilitado.
    return { received: true, duplicate: false };
  }

  /** Guard Fluxo A/carteira: Bearer valido + dono/admin do tenant (D-013/D-058). */
  private async requireTenantOwnerOrAdmin(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<void> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const allowed = await this.billing.isTenantOwnerOrAdmin(ctx.accountId, tenantId);
    if (!allowed) {
      throw new ForbiddenError('Requer dono ou admin deste tenant.');
    }
  }

  /** Guard Fluxo B: Bearer valido + perfil profissional NESTE tenant (D-002). */
  private async requireProfessional(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<{ professionalProfileId: string }> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const professional = await this.billing.findProfessional(ctx.accountId, tenantId);
    if (!professional) {
      throw new ForbiddenError('Requer um perfil profissional neste tenant.');
    }
    return professional;
  }
}

/** Soma meses a uma data em UTC, preservando o instante (base do periodo). */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

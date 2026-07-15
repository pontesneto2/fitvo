import type {
  ChargeMethod,
  ChargeStatus,
  OnboardingStatus,
  Periodicity,
  SubscriptionStatus,
} from '@fitvo/database';

/** Preco de um plano por periodicidade (centavos inteiros — D-069). */
export interface PlanPriceProjection {
  periodicity: Periodicity;
  amountCents: number;
}

/** Projecao de um plano do catalogo Nivel 1 (Fluxo A — D-060). */
export interface PlanRecord {
  id: string;
  code: string;
  name: string;
  tier: string;
  active: boolean;
  prices: PlanPriceProjection[];
}

/** Projecao da assinatura (Fluxo A — D-062). Datas em UTC (D-067). */
export interface SubscriptionRecord {
  id: string;
  tenantId: string;
  planId: string;
  periodicity: Periodicity;
  status: SubscriptionStatus;
  asaasSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  createdAt: Date;
}

/** Projecao da cobranca (Fluxo B — D-019). Dinheiro em centavos (D-069). */
export interface ChargeRecord {
  id: string;
  tenantId: string;
  bondId: string;
  amountCents: number;
  method: ChargeMethod;
  status: ChargeStatus;
  recurring: boolean;
  periodicity: Periodicity | null;
  asaasChargeId: string | null;
  professionalWalletId: string | null;
  platformFeeCents: number;
  description: string | null;
  dueDate: Date | null;
  createdAt: Date;
}

/** Subconta + taxa do tenant (D-050/D-058). walletId nulo ate o onboarding (GATED). */
export interface PaymentAccountRecord {
  asaasWalletId: string | null;
  feeBasisPoints: number;
  onboardingStatus: OnboardingStatus;
}

/** Extrato agregado da carteira do tenant (D-061). Tudo em centavos (D-069). */
export interface WalletSummary {
  receivedCents: number;
  pendingCents: number;
  feesCents: number;
}

export interface CreateSubscriptionRecordInput {
  tenantId: string;
  planId: string;
  periodicity: Periodicity;
  status: SubscriptionStatus;
  asaasSubscriptionId: string | null;
  idempotencyKey: string;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
}

export interface CreateChargeRecordInput {
  tenantId: string;
  bondId: string;
  amountCents: number;
  method: ChargeMethod;
  status: ChargeStatus;
  recurring: boolean;
  periodicity: Periodicity | null;
  asaasChargeId: string | null;
  idempotencyKey: string;
  professionalWalletId: string | null;
  platformFeeCents: number;
  description: string | null;
  dueDate: Date | null;
}

/**
 * Porta de persistencia da slice de billing (Repository Pattern — ADR-0004). O
 * dominio depende desta interface; a infra fornece a implementacao Prisma (ou
 * in-memory nos testes). Isolamento de tenant e inegociavel: toda leitura/escrita
 * de assinatura, cobranca e carteira e escopada por `tenantId` (D-002). A UNICA
 * excecao e o webhook — ele chega sem contexto de tenant e casa pelo id externo
 * (asaasChargeId/asaasSubscriptionId), que ja pertence a um tenant especifico.
 */
export interface BillingRepository {
  // --- Guards ---
  /** O chamador e dono/admin do tenant (CLINIC_ADMIN da clinica OU profissional
   *  cujo perfil vive no tenant = dono solo). Base do guard do Fluxo A/carteira. */
  isTenantOwnerOrAdmin(accountId: string, tenantId: string): Promise<boolean>;
  /** Perfil profissional do chamador NESTE tenant (base do guard de cobranca). */
  findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null>;
  /** Vinculo ATIVO do profissional (escopo tenant+profissional) — alvo da cobranca. */
  findActiveBondForProfessional(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
  ): Promise<{ bondId: string; patientProfileId: string } | null>;

  // --- Planos (Fluxo A) ---
  listActivePlans(): Promise<PlanRecord[]>;
  findPlan(planId: string): Promise<PlanRecord | null>;

  // --- Assinatura (Fluxo A) ---
  findPaymentAccount(tenantId: string): Promise<PaymentAccountRecord | null>;
  findSubscriptionByIdempotencyKey(idempotencyKey: string): Promise<SubscriptionRecord | null>;
  /** Assinatura NAO-terminal (TRIALING/ACTIVE/PAST_DUE) mais recente do tenant. */
  findCurrentSubscription(tenantId: string): Promise<SubscriptionRecord | null>;
  createSubscription(input: CreateSubscriptionRecordInput): Promise<SubscriptionRecord>;
  updateSubscriptionStatusByAsaasId(
    asaasSubscriptionId: string,
    status: SubscriptionStatus,
  ): Promise<boolean>;

  // --- Cobranca (Fluxo B) ---
  findChargeByIdempotencyKey(idempotencyKey: string): Promise<ChargeRecord | null>;
  createCharge(input: CreateChargeRecordInput): Promise<ChargeRecord>;
  updateChargeStatusByAsaasId(asaasChargeId: string, status: ChargeStatus): Promise<boolean>;

  // --- Webhook (idempotencia — D-035) ---
  /** Registra o evento; `true` se NOVO, `false` se ja processado (dedupe no-op). */
  recordWebhookEvent(asaasEventId: string, type: string, payload: unknown): Promise<boolean>;

  // --- Carteira (D-061) ---
  walletSummary(tenantId: string): Promise<WalletSummary>;
}

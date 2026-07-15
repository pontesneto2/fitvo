import type {
  ChargeStatus,
  OnboardingStatus,
  Periodicity,
  SubscriptionStatus,
} from '@fitvo/database';

import type {
  BillingRepository,
  ChargeRecord,
  CreateChargeRecordInput,
  CreateSubscriptionRecordInput,
  PaymentAccountRecord,
  PlanRecord,
  SubscriptionRecord,
  WalletSummary,
} from './billing-repository';

const NON_TERMINAL = new Set<SubscriptionStatus>(['TRIALING', 'ACTIVE', 'PAST_DUE']);
const RECEIVED_STATUSES = new Set<ChargeStatus>(['RECEIVED', 'CONFIRMED']);
const PENDING_STATUSES = new Set<ChargeStatus>(['PENDING', 'OVERDUE']);

interface StoredBond {
  bondId: string;
  tenantId: string;
  professionalProfileId: string;
  patientProfileId: string;
}

export interface SeedPlanInput {
  code: string;
  name: string;
  tier: string;
  active?: boolean;
  prices: { periodicity: Periodicity; amountCents: number }[];
}

export interface SeedPaymentAccountInput {
  asaasWalletId?: string | null;
  feeBasisPoints: number;
  onboardingStatus?: OnboardingStatus;
}

/**
 * Implementacao em memoria para testes e dev local. Espelha a logica Prisma
 * sobre Maps (o loop single-thread do Node torna cada operacao efetivamente
 * atomica). Os helpers `seed*` arranjam o mundo — planos, subcontas, donos/admins,
 * profissionais e vinculos vem de outras slices em producao.
 */
export class InMemoryBillingRepository implements BillingRepository {
  private readonly plans = new Map<string, PlanRecord>();
  private readonly paymentAccounts = new Map<string, PaymentAccountRecord>();
  private readonly owners = new Set<string>(); // `${accountId}:${tenantId}` = dono/admin
  private readonly professionals = new Map<string, string>(); // key -> professionalProfileId
  private readonly bonds = new Map<string, StoredBond>();
  private readonly subscriptions = new Map<string, SubscriptionRecord>();
  private readonly charges = new Map<string, ChargeRecord>();
  private readonly webhookEvents = new Set<string>();
  private sequence = 0;

  // --- Seed helpers (testes/dev; fora da interface de producao) ---

  /** Semeia um plano ativo com precos. Retorna o planId. */
  seedPlan(input: SeedPlanInput): string {
    const id = this.nextId('plan');
    this.plans.set(id, {
      id,
      code: input.code,
      name: input.name,
      tier: input.tier,
      active: input.active ?? true,
      prices: input.prices.map((price) => ({ ...price })),
    });
    return id;
  }

  /** Semeia a subconta/taxa do tenant. */
  seedPaymentAccount(tenantId: string, input: SeedPaymentAccountInput): void {
    this.paymentAccounts.set(tenantId, {
      asaasWalletId: input.asaasWalletId ?? null,
      feeBasisPoints: input.feeBasisPoints,
      onboardingStatus: input.onboardingStatus ?? 'PENDING',
    });
  }

  /** Semeia um admin de clinica (dono/admin, NAO profissional). */
  seedClinicAdmin(accountId: string, tenantId: string): void {
    this.owners.add(this.key(accountId, tenantId));
  }

  /** Semeia um profissional dono de tenant SOLO (profissional + dono). Retorna o profileId. */
  seedSoloProfessional(accountId: string, tenantId: string): string {
    const profileId = this.nextId('pp');
    this.professionals.set(this.key(accountId, tenantId), profileId);
    this.owners.add(this.key(accountId, tenantId));
    return profileId;
  }

  /** Semeia um profissional COMUM de clinica (profissional, NAO admin). Retorna o profileId. */
  seedClinicProfessional(accountId: string, tenantId: string): string {
    const profileId = this.nextId('pp');
    this.professionals.set(this.key(accountId, tenantId), profileId);
    return profileId;
  }

  /** Semeia um vinculo ATIVO do profissional. Retorna o bondId. */
  seedActiveBond(input: {
    tenantId: string;
    professionalProfileId: string;
    patientProfileId?: string;
  }): string {
    const bondId = this.nextId('bond');
    this.bonds.set(bondId, {
      bondId,
      tenantId: input.tenantId,
      professionalProfileId: input.professionalProfileId,
      patientProfileId: input.patientProfileId ?? this.nextId('patp'),
    });
    return bondId;
  }

  // --- BillingRepository ---

  isTenantOwnerOrAdmin(accountId: string, tenantId: string): Promise<boolean> {
    return Promise.resolve(this.owners.has(this.key(accountId, tenantId)));
  }

  findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null> {
    const professionalProfileId = this.professionals.get(this.key(accountId, tenantId));
    return Promise.resolve(professionalProfileId ? { professionalProfileId } : null);
  }

  findActiveBondForProfessional(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
  ): Promise<{ bondId: string; patientProfileId: string } | null> {
    const bond = this.bonds.get(bondId);
    if (
      !bond ||
      bond.tenantId !== tenantId ||
      bond.professionalProfileId !== professionalProfileId
    ) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ bondId: bond.bondId, patientProfileId: bond.patientProfileId });
  }

  listActivePlans(): Promise<PlanRecord[]> {
    const rows = [...this.plans.values()]
      .filter((plan) => plan.active)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((plan) => this.clonePlan(plan));
    return Promise.resolve(rows);
  }

  findPlan(planId: string): Promise<PlanRecord | null> {
    const plan = this.plans.get(planId);
    return Promise.resolve(plan ? this.clonePlan(plan) : null);
  }

  findPaymentAccount(tenantId: string): Promise<PaymentAccountRecord | null> {
    return Promise.resolve(this.paymentAccounts.get(tenantId) ?? null);
  }

  findSubscriptionByIdempotencyKey(idempotencyKey: string): Promise<SubscriptionRecord | null> {
    for (const sub of this.subscriptions.values()) {
      if (this.subIdempotency.get(sub.id) === idempotencyKey) {
        return Promise.resolve({ ...sub });
      }
    }
    return Promise.resolve(null);
  }

  findCurrentSubscription(tenantId: string): Promise<SubscriptionRecord | null> {
    const current = [...this.subscriptions.values()]
      .filter((sub) => sub.tenantId === tenantId && NON_TERMINAL.has(sub.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return Promise.resolve(current ? { ...current } : null);
  }

  createSubscription(input: CreateSubscriptionRecordInput): Promise<SubscriptionRecord> {
    const sub: SubscriptionRecord = {
      id: this.nextId('sub'),
      tenantId: input.tenantId,
      planId: input.planId,
      periodicity: input.periodicity,
      status: input.status,
      asaasSubscriptionId: input.asaasSubscriptionId,
      currentPeriodEnd: input.currentPeriodEnd,
      trialEndsAt: input.trialEndsAt,
      createdAt: new Date(),
    };
    this.subscriptions.set(sub.id, sub);
    this.subIdempotency.set(sub.id, input.idempotencyKey);
    return Promise.resolve({ ...sub });
  }

  updateSubscriptionStatusByAsaasId(
    asaasSubscriptionId: string,
    status: SubscriptionStatus,
  ): Promise<boolean> {
    let changed = false;
    for (const sub of this.subscriptions.values()) {
      if (sub.asaasSubscriptionId === asaasSubscriptionId) {
        sub.status = status;
        changed = true;
      }
    }
    return Promise.resolve(changed);
  }

  findChargeByIdempotencyKey(idempotencyKey: string): Promise<ChargeRecord | null> {
    const chargeId = this.chargeIdempotency.get(idempotencyKey);
    const charge = chargeId ? this.charges.get(chargeId) : undefined;
    return Promise.resolve(charge ? { ...charge } : null);
  }

  createCharge(input: CreateChargeRecordInput): Promise<ChargeRecord> {
    const charge: ChargeRecord = {
      id: this.nextId('chg'),
      tenantId: input.tenantId,
      bondId: input.bondId,
      amountCents: input.amountCents,
      method: input.method,
      status: input.status,
      recurring: input.recurring,
      periodicity: input.periodicity,
      asaasChargeId: input.asaasChargeId,
      professionalWalletId: input.professionalWalletId,
      platformFeeCents: input.platformFeeCents,
      description: input.description,
      dueDate: input.dueDate,
      createdAt: new Date(),
    };
    this.charges.set(charge.id, charge);
    this.chargeIdempotency.set(input.idempotencyKey, charge.id);
    return Promise.resolve({ ...charge });
  }

  updateChargeStatusByAsaasId(asaasChargeId: string, status: ChargeStatus): Promise<boolean> {
    let changed = false;
    for (const charge of this.charges.values()) {
      if (charge.asaasChargeId === asaasChargeId) {
        charge.status = status;
        changed = true;
      }
    }
    return Promise.resolve(changed);
  }

  recordWebhookEvent(asaasEventId: string, _type: string, _payload: unknown): Promise<boolean> {
    if (this.webhookEvents.has(asaasEventId)) {
      return Promise.resolve(false);
    }
    this.webhookEvents.add(asaasEventId);
    return Promise.resolve(true);
  }

  walletSummary(tenantId: string): Promise<WalletSummary> {
    let receivedCents = 0;
    let pendingCents = 0;
    let feesCents = 0;
    for (const charge of this.charges.values()) {
      if (charge.tenantId !== tenantId) {
        continue;
      }
      if (RECEIVED_STATUSES.has(charge.status)) {
        receivedCents += charge.amountCents;
        feesCents += charge.platformFeeCents;
      } else if (PENDING_STATUSES.has(charge.status)) {
        pendingCents += charge.amountCents;
      }
    }
    return Promise.resolve({ receivedCents, pendingCents, feesCents });
  }

  // --- helpers privados ---

  private readonly subIdempotency = new Map<string, string>(); // subId -> idempotencyKey
  private readonly chargeIdempotency = new Map<string, string>(); // idempotencyKey -> chargeId

  private clonePlan(plan: PlanRecord): PlanRecord {
    return { ...plan, prices: plan.prices.map((price) => ({ ...price })) };
  }

  private key(accountId: string, tenantId: string): string {
    return `${accountId}:${tenantId}`;
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }
}

import type { ChargeStatus, PrismaClient, SubscriptionStatus } from '@fitvo/database';
import {
  Prisma,
  prisma as defaultPrisma,
  webhookPrisma as defaultWebhookPrisma,
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

/** Status NAO-terminais de assinatura (varredura da regua e "vigente"). */
const NON_TERMINAL: SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE'];
/** Status que contam como recebido (extrato — D-061). */
const RECEIVED_STATUSES: ChargeStatus[] = ['RECEIVED', 'CONFIRMED'];
/** Status que contam como a receber (extrato — D-061). */
const PENDING_STATUSES: ChargeStatus[] = ['PENDING', 'OVERDUE'];

const SUBSCRIPTION_PROJECTION = {
  id: true,
  tenantId: true,
  planId: true,
  periodicity: true,
  status: true,
  asaasSubscriptionId: true,
  currentPeriodEnd: true,
  trialEndsAt: true,
  createdAt: true,
} as const;

const CHARGE_PROJECTION = {
  id: true,
  tenantId: true,
  bondId: true,
  amountCents: true,
  method: true,
  status: true,
  recurring: true,
  periodicity: true,
  asaasChargeId: true,
  professionalWalletId: true,
  platformFeeCents: true,
  description: true,
  dueDate: true,
  createdAt: true,
} as const;

/** Implementacao Prisma (infra) do repositorio de billing (ADR-0004). */
export class PrismaBillingRepository implements BillingRepository {
  constructor(
    private readonly db: PrismaClient = defaultPrisma,
    // Conexao SEPARADA, role fitvo_webhook (D-155, ADR-0017 Slice 3/3): SO usada
    // pelas 2 atualizacoes por id externo do Asaas abaixo, que rodam sem
    // tenantId conhecido a priori (webhook nao tem sessao/tenant aberto, e ler
    // a linha pra descobrir o tenant TAMBEM e bloqueado pelo RLS sem sessao --
    // problema da galinha e o ovo). Nunca usar `webhookDb` fora destes 2 metodos.
    private readonly webhookDb: PrismaClient = defaultWebhookPrisma,
  ) {}

  async isTenantOwnerOrAdmin(accountId: string, tenantId: string): Promise<boolean> {
    // Dono/admin (default documentado — ADR-0004): admin de clinica
    // (ClinicMembership CLINIC_ADMIN) OU o profissional dono de um tenant SOLO
    // (tenant de 1 pessoa — D-045). Um profissional COMUM dentro de uma CLINICA
    // NAO e admin (o financeiro da clinica e do admin — D-013/D-058).
    const [membership, soloOwner] = await Promise.all([
      this.db.clinicMembership.findUnique({
        where: { accountId_tenantId: { accountId, tenantId } },
        select: { role: true },
      }),
      this.db.professionalProfile.findFirst({
        where: { accountId, tenantId, tenant: { type: 'SOLO' } },
        select: { id: true },
      }),
    ]);
    return membership?.role === 'CLINIC_ADMIN' || soloOwner !== null;
  }

  async findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null> {
    const profile = await this.db.professionalProfile.findFirst({
      where: { accountId, tenantId },
      select: { id: true },
    });
    return profile ? { professionalProfileId: profile.id } : null;
  }

  async findActiveBondForProfessional(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
  ): Promise<{ bondId: string; patientProfileId: string } | null> {
    const bond = await this.db.bond.findFirst({
      where: { id: bondId, tenantId, professionalProfileId, status: 'ACTIVE' },
      select: { id: true, patientProfileId: true },
    });
    return bond ? { bondId: bond.id, patientProfileId: bond.patientProfileId } : null;
  }

  async listActivePlans(): Promise<PlanRecord[]> {
    const plans = await this.db.plan.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        name: true,
        tier: true,
        active: true,
        prices: { select: { periodicity: true, amountCents: true } },
      },
      orderBy: { code: 'asc' },
    });
    return plans.map((plan) => ({ ...plan, prices: [...plan.prices] }));
  }

  async findPlan(planId: string): Promise<PlanRecord | null> {
    const plan = await this.db.plan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        code: true,
        name: true,
        tier: true,
        active: true,
        prices: { select: { periodicity: true, amountCents: true } },
      },
    });
    return plan ? { ...plan, prices: [...plan.prices] } : null;
  }

  findPaymentAccount(tenantId: string): Promise<PaymentAccountRecord | null> {
    return this.db.paymentAccount.findUnique({
      where: { tenantId },
      select: { asaasWalletId: true, feeBasisPoints: true, onboardingStatus: true },
    });
  }

  findSubscriptionByIdempotencyKey(idempotencyKey: string): Promise<SubscriptionRecord | null> {
    return this.db.subscription.findUnique({
      where: { idempotencyKey },
      select: SUBSCRIPTION_PROJECTION,
    });
  }

  findCurrentSubscription(tenantId: string): Promise<SubscriptionRecord | null> {
    return this.db.subscription.findFirst({
      where: { tenantId, status: { in: NON_TERMINAL } },
      select: SUBSCRIPTION_PROJECTION,
      orderBy: { createdAt: 'desc' },
    });
  }

  createSubscription(input: CreateSubscriptionRecordInput): Promise<SubscriptionRecord> {
    return this.db.subscription.create({ data: input, select: SUBSCRIPTION_PROJECTION });
  }

  async updateSubscriptionStatusByAsaasId(
    asaasSubscriptionId: string,
    status: SubscriptionStatus,
  ): Promise<boolean> {
    const result = await this.webhookDb.subscription.updateMany({
      where: { asaasSubscriptionId },
      data: { status },
    });
    return result.count > 0;
  }

  findChargeByIdempotencyKey(idempotencyKey: string): Promise<ChargeRecord | null> {
    return this.db.charge.findUnique({ where: { idempotencyKey }, select: CHARGE_PROJECTION });
  }

  createCharge(input: CreateChargeRecordInput): Promise<ChargeRecord> {
    return this.db.charge.create({ data: input, select: CHARGE_PROJECTION });
  }

  async updateChargeStatusByAsaasId(asaasChargeId: string, status: ChargeStatus): Promise<boolean> {
    const result = await this.webhookDb.charge.updateMany({
      where: { asaasChargeId },
      data: { status },
    });
    return result.count > 0;
  }

  async recordWebhookEvent(asaasEventId: string, type: string, payload: unknown): Promise<boolean> {
    // Race-safe: o unique em asaasEventId dedupe. Uma reentrega colide (P2002) e
    // vira no-op (`false`) — a idempotencia de webhook (D-035).
    try {
      await this.db.webhookEvent.create({
        data: {
          asaasEventId,
          type,
          payload: (payload ?? {}) as Prisma.InputJsonValue,
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  async walletSummary(tenantId: string): Promise<WalletSummary> {
    const [received, pending, fees] = await Promise.all([
      this.db.charge.aggregate({
        where: { tenantId, status: { in: RECEIVED_STATUSES } },
        _sum: { amountCents: true },
      }),
      this.db.charge.aggregate({
        where: { tenantId, status: { in: PENDING_STATUSES } },
        _sum: { amountCents: true },
      }),
      this.db.charge.aggregate({
        where: { tenantId, status: { in: RECEIVED_STATUSES } },
        _sum: { platformFeeCents: true },
      }),
    ]);
    return {
      receivedCents: received._sum.amountCents ?? 0,
      pendingCents: pending._sum.amountCents ?? 0,
      feesCents: fees._sum.platformFeeCents ?? 0,
    };
  }
}

import { describe, expect, it } from 'vitest';

import { InMemoryBillingRepository } from './in-memory-billing-repository';

const TENANT = 'tenant_1';
const ACCOUNT = 'acc_1';

function repoWithPlan(): { repo: InMemoryBillingRepository; planId: string } {
  const repo = new InMemoryBillingRepository();
  const planId = repo.seedPlan({
    code: 'solo',
    name: 'Solo',
    tier: 'solo',
    prices: [{ periodicity: 'MONTHLY', amountCents: 9900 }],
  });
  return { repo, planId };
}

describe('InMemoryBillingRepository', () => {
  it('dono solo e admin; profissional comum de clinica NAO e', async () => {
    const repo = new InMemoryBillingRepository();
    repo.seedSoloProfessional(ACCOUNT, TENANT);
    repo.seedClinicProfessional('acc_2', 'tenant_2');

    expect(await repo.isTenantOwnerOrAdmin(ACCOUNT, TENANT)).toBe(true);
    expect(await repo.isTenantOwnerOrAdmin('acc_2', 'tenant_2')).toBe(false);
    expect(await repo.findProfessional('acc_2', 'tenant_2')).not.toBeNull();
  });

  it('admin de clinica e dono/admin sem ser profissional', async () => {
    const repo = new InMemoryBillingRepository();
    repo.seedClinicAdmin(ACCOUNT, TENANT);
    expect(await repo.isTenantOwnerOrAdmin(ACCOUNT, TENANT)).toBe(true);
    expect(await repo.findProfessional(ACCOUNT, TENANT)).toBeNull();
  });

  it('lista apenas planos ativos e devolve preco por periodicidade', async () => {
    const { repo, planId } = repoWithPlan();
    repo.seedPlan({ code: 'inactive', name: 'X', tier: 'x', active: false, prices: [] });

    const plans = await repo.listActivePlans();
    expect(plans).toHaveLength(1);
    expect(plans[0]?.id).toBe(planId);
    expect(plans[0]?.prices).toEqual([{ periodicity: 'MONTHLY', amountCents: 9900 }]);
  });

  it('replay de assinatura pela idempotencyKey e a assinatura vigente NAO-terminal', async () => {
    const { repo, planId } = repoWithPlan();
    const created = await repo.createSubscription({
      tenantId: TENANT,
      planId,
      periodicity: 'MONTHLY',
      status: 'TRIALING',
      asaasSubscriptionId: 'sub_ext',
      idempotencyKey: 'idem-sub-1',
      currentPeriodEnd: new Date(),
      trialEndsAt: new Date(),
    });

    expect((await repo.findSubscriptionByIdempotencyKey('idem-sub-1'))?.id).toBe(created.id);
    expect((await repo.findCurrentSubscription(TENANT))?.id).toBe(created.id);

    // Cancelada deixa de ser "vigente".
    await repo.updateSubscriptionStatusByAsaasId('sub_ext', 'CANCELED');
    expect(await repo.findCurrentSubscription(TENANT)).toBeNull();
  });

  it('cobranca: replay por idempotencyKey e agregacao da carteira por status', async () => {
    const repo = new InMemoryBillingRepository();
    const paid = await repo.createCharge({
      tenantId: TENANT,
      bondId: 'bond_1',
      amountCents: 10_000,
      method: 'PIX',
      status: 'RECEIVED',
      recurring: false,
      periodicity: null,
      asaasChargeId: 'chg_ext_1',
      idempotencyKey: 'idem-chg-1',
      professionalWalletId: 'w',
      platformFeeCents: 500,
      description: null,
      dueDate: null,
    });
    await repo.createCharge({
      tenantId: TENANT,
      bondId: 'bond_1',
      amountCents: 3_000,
      method: 'BOLETO',
      status: 'PENDING',
      recurring: false,
      periodicity: null,
      asaasChargeId: 'chg_ext_2',
      idempotencyKey: 'idem-chg-2',
      professionalWalletId: 'w',
      platformFeeCents: 150,
      description: null,
      dueDate: null,
    });

    expect((await repo.findChargeByIdempotencyKey('idem-chg-1'))?.id).toBe(paid.id);

    const summary = await repo.walletSummary(TENANT);
    expect(summary).toEqual({ receivedCents: 10_000, pendingCents: 3_000, feesCents: 500 });

    // Webhook move a cobranca pendente para recebida -> reflete no extrato.
    expect(await repo.updateChargeStatusByAsaasId('chg_ext_2', 'RECEIVED')).toBe(true);
    const after = await repo.walletSummary(TENANT);
    expect(after).toEqual({ receivedCents: 13_000, pendingCents: 0, feesCents: 650 });
  });

  it('ledger de webhook dedupe: novo -> true, reentrega -> false', async () => {
    const repo = new InMemoryBillingRepository();
    expect(await repo.recordWebhookEvent('evt_1', 'PAYMENT_RECEIVED', {})).toBe(true);
    expect(await repo.recordWebhookEvent('evt_1', 'PAYMENT_RECEIVED', {})).toBe(false);
  });
});

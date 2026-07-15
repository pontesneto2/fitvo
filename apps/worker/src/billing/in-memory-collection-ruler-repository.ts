import type { SubscriptionStatus } from '@fitvo/database';

import type {
  CollectionRulerRepository,
  RulerSubscriptionRecord,
} from './collection-ruler-repository';

const NON_TERMINAL = new Set<SubscriptionStatus>(['TRIALING', 'ACTIVE', 'PAST_DUE']);

/**
 * Implementacao em memoria do repositorio da regua (testes/dev). Espelha a
 * logica Prisma sobre um Map — permite testar a regua SEM Redis nem Postgres.
 * `seedSubscription` arranja o mundo (as assinaturas vem da slice de billing).
 */
export class InMemoryCollectionRulerRepository implements CollectionRulerRepository {
  private readonly subscriptions = new Map<string, RulerSubscriptionRecord>();

  /** Semeia uma assinatura para a regua avaliar. */
  seedSubscription(record: RulerSubscriptionRecord): void {
    this.subscriptions.set(record.id, { ...record });
  }

  /** Status atual de uma assinatura (para asserts nos testes). */
  statusOf(subscriptionId: string): SubscriptionStatus | undefined {
    return this.subscriptions.get(subscriptionId)?.status;
  }

  listRulerSubscriptions(): Promise<RulerSubscriptionRecord[]> {
    const rows = [...this.subscriptions.values()]
      .filter((sub) => NON_TERMINAL.has(sub.status) && sub.currentPeriodEnd !== null)
      .map((sub) => ({ ...sub }));
    return Promise.resolve(rows);
  }

  updateStatus(subscriptionId: string, status: SubscriptionStatus): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.status = status;
    }
    return Promise.resolve();
  }
}

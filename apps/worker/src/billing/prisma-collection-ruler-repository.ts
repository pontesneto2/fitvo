import type { PrismaClient, SubscriptionStatus } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import type {
  CollectionRulerRepository,
  RulerSubscriptionRecord,
} from './collection-ruler-repository';

const NON_TERMINAL: SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE'];

/** Implementacao Prisma (infra) do repositorio da regua de cobranca. */
export class PrismaCollectionRulerRepository implements CollectionRulerRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  listRulerSubscriptions(): Promise<RulerSubscriptionRecord[]> {
    return this.db.subscription.findMany({
      where: { status: { in: NON_TERMINAL }, currentPeriodEnd: { not: null } },
      select: { id: true, tenantId: true, status: true, currentPeriodEnd: true },
    });
  }

  async updateStatus(subscriptionId: string, status: SubscriptionStatus): Promise<void> {
    await this.db.subscription.update({ where: { id: subscriptionId }, data: { status } });
  }
}

import type { PrismaClient, SubscriptionStatus } from '@fitvo/database';
import { webhookPrisma as defaultWebhookPrisma } from '@fitvo/database';

import type {
  CollectionRulerRepository,
  RulerSubscriptionRecord,
} from './collection-ruler-repository';

const NON_TERMINAL: SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE'];

/**
 * Implementacao Prisma (infra) do repositorio da regua de cobranca. Usa o
 * client `webhookPrisma` (role `fitvo_webhook`, D-155/ADR-0017 Slice 3/3) por
 * padrao -- a varredura le/atualiza subscription de TODOS os tenants, sem
 * filtro nenhum (job de fundo, sem ALS aberto), o mesmo formato do gap do
 * webhook Asaas. Nunca o client padrao da app aqui.
 */
export class PrismaCollectionRulerRepository implements CollectionRulerRepository {
  constructor(private readonly db: PrismaClient = defaultWebhookPrisma) {}

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

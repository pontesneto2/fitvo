import type { SubscriptionStatus } from '@fitvo/database';

/**
 * Projecao minima da assinatura para a regua de cobranca (Fluxo A — ADR-0004).
 * Datas em UTC (D-067).
 */
export interface RulerSubscriptionRecord {
  id: string;
  tenantId: string;
  status: SubscriptionStatus;
  /** Vencimento do periodo atual — base da regua. `null` se ainda nao definido. */
  currentPeriodEnd: Date | null;
}

/**
 * Porta de persistencia da regua de cobranca (Repository Pattern). O dominio
 * (CollectionRulerService) depende desta interface; a infra fornece a
 * implementacao Prisma (ou in-memory nos testes) — a regua e testavel SEM Redis
 * nem Postgres. Isolamento de tenant (D-002) preservado: a regua opera sobre
 * assinaturas ja pertencentes a tenants; nao ha leitura cruzada de dados.
 */
export interface CollectionRulerRepository {
  /**
   * Assinaturas NAO-terminais (TRIALING/ACTIVE/PAST_DUE) com vencimento definido
   * — o conjunto que a regua avalia. SUSPENDED/CANCELED sao terminais e saem da
   * varredura (suspensao != exclusao — D-021).
   */
  listRulerSubscriptions(): Promise<RulerSubscriptionRecord[]>;

  /** Transiciona o status de uma assinatura (ACTIVE->PAST_DUE->SUSPENDED). */
  updateStatus(subscriptionId: string, status: SubscriptionStatus): Promise<void>;
}

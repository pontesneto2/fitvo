import { PrismaClient } from './generated/client';
import { tenantIsolationQueryExtension } from './tenant-isolation-extension';

/**
 * Cliente Prisma SEPARADO (conexao propria), conectado com o role
 * `fitvo_webhook` (D-155, ADR-0017 Slice 3/3) -- SEM BYPASSRLS, mas com uma
 * policy PERMISSIVA adicional (so pra ele, so em `charge`/`subscription`,
 * so nos comandos que de fato usa) que autoriza atravessar tenant, achado
 * necessario ao implementar o RLS: o webhook do Asaas atualiza charge/
 * subscription por `asaasChargeId`/`asaasSubscriptionId` SEM saber o tenantId
 * a priori (nao da pra "descobrir" o tenant lendo a linha, porque a leitura
 * TAMBEM e bloqueada pelo RLS sem sessao setada -- problema da galinha e o
 * ovo). A regua de cobranca do worker (apps/worker, varredura de TODAS as
 * subscriptions nao-terminais sem filtro de tenant) tem o MESMO formato e usa
 * o MESMO client.
 *
 * NUNCA usar este client fora dos 3 call sites ja auditados
 * (updateSubscriptionStatusByAsaasId/updateChargeStatusByAsaasId em
 * prisma-billing-repository.ts, e PrismaCollectionRulerRepository no worker)
 * -- ele so tem GRANT de SELECT/UPDATE nessas 2 tabelas no Postgres; qualquer
 * outro uso falha na camada de privilegio antes mesmo do RLS entrar.
 */
const globalForWebhookPrisma = globalThis as unknown as { webhookPrisma?: PrismaClient };

/**
 * `WEBHOOK_DATABASE_URL` so falta em processos que nunca chamam os 3 call
 * sites que usam este client (ex.: testes que nao tocam billing) -- por isso
 * o fallback pra `DATABASE_URL` em vez de lancar aqui: falha alto e claro na
 * CONEXAO (role errado/inexistente) se alguem realmente tentar usar, em vez
 * de derrubar todo processo que so importa `@fitvo/database`.
 */
const webhookDatabaseUrl = process.env.WEBHOOK_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

const baseWebhookPrisma: PrismaClient =
  globalForWebhookPrisma.webhookPrisma ?? new PrismaClient({ datasourceUrl: webhookDatabaseUrl });

if (process.env.NODE_ENV !== 'production') {
  globalForWebhookPrisma.webhookPrisma = baseWebhookPrisma;
}

export const webhookPrisma: PrismaClient = baseWebhookPrisma.$extends({
  query: tenantIsolationQueryExtension,
}) as unknown as PrismaClient;

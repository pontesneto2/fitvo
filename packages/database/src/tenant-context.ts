import { AsyncLocalStorage } from 'node:async_hooks';

/** Contexto implícito de tenant da requisição (D-150 — ADR-0017, Camada 1). */
export interface TenantContext {
  tenantId: string;
}

const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Abre o contexto de tenant para a extensao (sincrona ou assincrona) de `fn`.
 * O contexto sobrevive a qualquer await encadeado dentro de `fn` (natureza do
 * AsyncLocalStorage) e nao vaza para chamadas concorrentes fora desta execucao.
 *
 * Mora em `@fitvo/database` (movido do slice 1 — apps/api/src/shared) porque a
 * Prisma Client extension de isolamento de tenant (D-151 — tenant-isolation-
 * extension.ts, MESMO pacote) precisa ler este contexto, e um pacote nao pode
 * depender de `apps/api`. O hook Fastify que ABRE o contexto (apps/api/src/
 * shared/tenant-context-hook.ts) importa `runWithTenantContext` DAQUI — e a
 * MESMA instancia de AsyncLocalStorage (singleton do modulo) que a extension
 * le, senao a extension nunca veria o que o hook abriu.
 *
 * ARMADILHA (achada e corrigida na bateria de teste do slice 2 — ver
 * tenant-isolation-extension.integration.test.ts): `fn` PRECISA disparar a
 * chamada Prisma com `await` de verdade DENTRO da sua propria execucao —
 * nunca `runWithTenantContext(id, () => prisma.model.metodo(args))` sem
 * `await` ali dentro. O Prisma devolve uma PROMISE PREGUICOSA: so entra na
 * extension (e so ai lê o contexto) quando algo chama `.then()`/`await` nela.
 * `AsyncLocalStorage.run(store, fn)` só mantém `store` ativo durante a
 * extensão SÍNCRONA da chamada a `fn`; um `fn` que so devolve a promise crua
 * (sem await) faz `run()` retornar ANTES de qualquer coisa disparar essa
 * promise — a extension roda depois, sem contexto, e a query passa sem
 * escopo. Use sempre `runWithTenantContext(id, async () => await
 * prisma.model.metodo(args))`. No hook Fastify (tenant-context-hook.ts) isto
 * NÃO é risco: `done` dispara sincronamente a próxima hook/handler (sempre
 * `async`), e cada `await` daí pra baixo agenda sua continuação ainda dentro
 * da cadeia rastreada — o risco é só em código que chama esta função "por
 * fora" do pipeline HTTP (scripts, testes, jobs de worker).
 */
export function runWithTenantContext<T>(tenantId: string, fn: () => T): T {
  return tenantContextStorage.run({ tenantId }, fn);
}

/** Tenant ativo da requisicao corrente, ou `undefined` se nenhum contexto foi aberto. */
export function getTenantContext(): string | undefined {
  return tenantContextStorage.getStore()?.tenantId;
}

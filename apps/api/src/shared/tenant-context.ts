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
 */
export function runWithTenantContext<T>(tenantId: string, fn: () => T): T {
  return tenantContextStorage.run({ tenantId }, fn);
}

/** Tenant ativo da requisicao corrente, ou `undefined` se nenhum contexto foi aberto. */
export function getTenantContext(): string | undefined {
  return tenantContextStorage.getStore()?.tenantId;
}

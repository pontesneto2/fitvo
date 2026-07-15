/**
 * @fitvo/cache — contrato de cache sobre Redis (D-026): get/set/delete e
 * invalidacao por padrao. Alem do contrato, expoe o adaptador concreto
 * (`RedisCacheStore`, SCAN em vez de KEYS) e a store em memoria
 * (`InMemoryCacheStore`) para testes e dev local.
 */

export interface CacheSetOptions {
  ttlSeconds?: number;
}

export interface CacheStore {
  get<TValue>(key: string): Promise<TValue | null>;
  set<TValue>(key: string, value: TValue, options?: CacheSetOptions): Promise<void>;
  delete(key: string): Promise<void>;
  /** Invalida chaves por padrao (ex.: "user:*"). */
  invalidate(pattern: string): Promise<void>;
}

// Adaptadores concretos (D-026). O dominio depende apenas de `CacheStore`.
export { InMemoryCacheStore } from './in-memory-cache-store';
export { globToRegExp } from './pattern';
export { RedisCacheStore } from './redis-cache-store';

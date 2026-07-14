/**
 * @fitvo/cache — contrato de cache sobre Redis (D-026): get/set/delete e
 * invalidacao por padrao. Interfaces apenas; adaptador em fase posterior.
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

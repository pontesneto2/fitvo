import type { CacheSetOptions, CacheStore } from './index';
import { globToRegExp } from './pattern';

interface Entry {
  /** Valor ja serializado (espelha o comportamento JSON da store Redis). */
  raw: string;
  /** Epoch em ms de expiracao; undefined => sem TTL. */
  expiresAt?: number;
}

/**
 * Store de cache em memoria (Map), DETERMINISTICA e sem infra — o fake do
 * contrato `CacheStore` para testes e dev local. Serializa via JSON (igual ao
 * adaptador Redis), respeita TTL (expiracao preguicosa na leitura) e suporta
 * `invalidate(pattern)` com a mesma semantica de glob do Redis.
 */
export class InMemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, Entry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  get<TValue>(key: string): Promise<TValue | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }
    if (entry.expiresAt !== undefined && entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(JSON.parse(entry.raw) as TValue);
  }

  set<TValue>(key: string, value: TValue, options?: CacheSetOptions): Promise<void> {
    const entry: Entry = { raw: JSON.stringify(value) };
    if (options?.ttlSeconds !== undefined) {
      entry.expiresAt = this.now() + options.ttlSeconds * 1000;
    }
    this.store.set(key, entry);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  invalidate(pattern: string): Promise<void> {
    const matcher = globToRegExp(pattern);
    for (const key of this.store.keys()) {
      if (matcher.test(key)) {
        this.store.delete(key);
      }
    }
    return Promise.resolve();
  }
}

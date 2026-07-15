import type { Redis } from 'ioredis';

import type { CacheSetOptions, CacheStore } from './index';

/**
 * Adaptador concreto de `CacheStore` sobre Redis (ioredis) — D-026. Serializa
 * valores em JSON, aplica TTL via `SET ... EX` e implementa `invalidate(pattern)`
 * com SCAN incremental (NUNCA KEYS, que bloqueia o Redis em bases grandes).
 *
 * A conexao ioredis e INJETADA (mesma convencao do resto do monorepo), o que
 * mantem o adaptador testavel contra um Redis real (integracao gated por
 * REDIS_URL) sem gerir o ciclo de vida da conexao aqui.
 */
export class RedisCacheStore implements CacheStore {
  /** Tamanho do lote do SCAN — equilibra round-trips e trabalho por iteracao. */
  private static readonly SCAN_COUNT = 100;

  constructor(private readonly redis: Redis) {}

  async get<TValue>(key: string): Promise<TValue | null> {
    const raw = await this.redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as TValue);
  }

  async set<TValue>(key: string, value: TValue, options?: CacheSetOptions): Promise<void> {
    const raw = JSON.stringify(value);
    if (options?.ttlSeconds !== undefined) {
      await this.redis.set(key, raw, 'EX', options.ttlSeconds);
    } else {
      await this.redis.set(key, raw);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidate(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        RedisCacheStore.SCAN_COUNT,
      );
      cursor = next;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}

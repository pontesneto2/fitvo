import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RedisCacheStore } from './index';

const REDIS_URL = process.env.REDIS_URL;

/**
 * Teste de INTEGRACAO contra um Redis real, GUARDADO por REDIS_URL: roda quando
 * a variavel esta setada (ex.: docker local em localhost:6380) e faz skip limpo
 * caso contrario (CI sem Redis). Usa um prefixo unico por execucao para nao
 * colidir com outras chaves e limpa tudo no fim.
 */
describe.skipIf(!REDIS_URL)('RedisCacheStore (integracao — REDIS_URL)', () => {
  let redis: Redis;
  let cache: RedisCacheStore;
  const prefix = `test:cache:${process.pid}:${Date.now()}:`;

  beforeAll(() => {
    redis = new Redis(REDIS_URL as string, { maxRetriesPerRequest: null });
    cache = new RedisCacheStore(redis);
  });

  afterAll(async () => {
    if (redis) {
      await cache.invalidate(`${prefix}*`);
      await redis.quit();
    }
  });

  it('faz roundtrip com serializacao JSON', async () => {
    const key = `${prefix}user:1`;
    await cache.set(key, { id: 1, name: 'Ana' });
    expect(await cache.get(key)).toEqual({ id: 1, name: 'Ana' });
    expect(await cache.get(`${prefix}ausente`)).toBeNull();
  });

  it('aplica TTL via SET EX', async () => {
    const key = `${prefix}ttl`;
    await cache.set(key, 'v', { ttlSeconds: 60 });
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it('remove uma chave (delete)', async () => {
    const key = `${prefix}del`;
    await cache.set(key, 1);
    await cache.delete(key);
    expect(await cache.get(key)).toBeNull();
  });

  it('invalida por padrao via SCAN sem afetar chaves fora do padrao', async () => {
    await cache.set(`${prefix}user:1`, 'a');
    await cache.set(`${prefix}user:2`, 'b');
    await cache.set(`${prefix}post:1`, 'c');

    await cache.invalidate(`${prefix}user:*`);

    expect(await cache.get(`${prefix}user:1`)).toBeNull();
    expect(await cache.get(`${prefix}user:2`)).toBeNull();
    expect(await cache.get(`${prefix}post:1`)).toBe('c');
  });
});

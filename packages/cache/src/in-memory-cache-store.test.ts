import { describe, expect, it } from 'vitest';

import { globToRegExp, InMemoryCacheStore } from './index';

describe('InMemoryCacheStore', () => {
  it('faz roundtrip de valores serializaveis (get/set)', async () => {
    const cache = new InMemoryCacheStore();
    await cache.set('user:1', { id: 1, name: 'Ana' });
    expect(await cache.get('user:1')).toEqual({ id: 1, name: 'Ana' });
    expect(await cache.get('inexistente')).toBeNull();
  });

  it('expira o valor apos o TTL (relogio injetado)', async () => {
    let now = 1_000;
    const cache = new InMemoryCacheStore(() => now);
    await cache.set('k', 'v', { ttlSeconds: 10 });

    now = 1_000 + 9_999;
    expect(await cache.get('k')).toBe('v');

    now = 1_000 + 10_000;
    expect(await cache.get('k')).toBeNull();
  });

  it('remove uma chave (delete)', async () => {
    const cache = new InMemoryCacheStore();
    await cache.set('k', 1);
    await cache.delete('k');
    expect(await cache.get('k')).toBeNull();
  });

  it('invalida por padrao glob sem tocar em chaves fora do padrao', async () => {
    const cache = new InMemoryCacheStore();
    await cache.set('user:1', 'a');
    await cache.set('user:2', 'b');
    await cache.set('post:1', 'c');

    await cache.invalidate('user:*');

    expect(await cache.get('user:1')).toBeNull();
    expect(await cache.get('user:2')).toBeNull();
    expect(await cache.get('post:1')).toBe('c');
  });
});

describe('globToRegExp', () => {
  it('traduz * e ? e escapa metacaracteres de regex', () => {
    expect(globToRegExp('user:*').test('user:42')).toBe(true);
    expect(globToRegExp('user:*').test('post:42')).toBe(false);
    expect(globToRegExp('k?').test('ka')).toBe(true);
    expect(globToRegExp('k?').test('kab')).toBe(false);
    // Um ponto literal no padrao NAO deve virar coringa.
    expect(globToRegExp('a.b').test('axb')).toBe(false);
    expect(globToRegExp('a.b').test('a.b')).toBe(true);
  });
});

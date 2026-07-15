import type { Redis } from 'ioredis';

import type { RefreshTokenStore, RotateOutcome } from './types';

/** Store em memoria — para testes e desenvolvimento local. Nao usar em producao. */
export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly current = new Map<string, string>();
  private readonly revoked = new Set<string>();

  startSession(sessionId: string, jti: string, _ttlSeconds: number): Promise<void> {
    this.revoked.delete(sessionId);
    this.current.set(sessionId, jti);
    return Promise.resolve();
  }

  rotate(
    sessionId: string,
    oldJti: string,
    newJti: string,
    _ttlSeconds: number,
  ): Promise<RotateOutcome> {
    if (this.revoked.has(sessionId)) {
      return Promise.resolve('revoked');
    }
    const currentJti = this.current.get(sessionId);
    if (currentJti === undefined) {
      return Promise.resolve('revoked');
    }
    if (currentJti !== oldJti) {
      // Reuso de um refresh antigo: revoga a familia inteira (D-029).
      this.revoked.add(sessionId);
      this.current.delete(sessionId);
      return Promise.resolve('reuse');
    }
    this.current.set(sessionId, newJti);
    return Promise.resolve('ok');
  }

  revoke(sessionId: string): Promise<void> {
    this.revoked.add(sessionId);
    this.current.delete(sessionId);
    return Promise.resolve();
  }

  isActive(sessionId: string): Promise<boolean> {
    return Promise.resolve(this.current.has(sessionId) && !this.revoked.has(sessionId));
  }
}

/**
 * Store de refresh tokens em Redis (producao — D-029). A rotacao e atomica via
 * Lua: compara o jti atual, detecta reuso e revoga a familia numa unica operacao
 * (sem corrida entre leitura e escrita).
 */
export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'auth:session:',
  ) {}

  private key(sessionId: string): string {
    return `${this.prefix}${sessionId}`;
  }

  async startSession(sessionId: string, jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.key(sessionId), jti, 'EX', ttlSeconds);
  }

  async rotate(
    sessionId: string,
    oldJti: string,
    newJti: string,
    ttlSeconds: number,
  ): Promise<RotateOutcome> {
    const script = `
      local cur = redis.call('GET', KEYS[1])
      if not cur then return 'revoked' end
      if cur ~= ARGV[1] then redis.call('DEL', KEYS[1]); return 'reuse' end
      redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
      return 'ok'
    `;
    const result = await this.redis.eval(
      script,
      1,
      this.key(sessionId),
      oldJti,
      newJti,
      String(ttlSeconds),
    );
    return String(result) as RotateOutcome;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }

  async isActive(sessionId: string): Promise<boolean> {
    return (await this.redis.exists(this.key(sessionId))) === 1;
  }
}

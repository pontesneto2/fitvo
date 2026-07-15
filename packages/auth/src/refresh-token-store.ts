import type { Redis } from 'ioredis';

import type { RefreshTokenStore, RotateOutcome } from './types';

/** Store em memoria — para testes e desenvolvimento local. Nao usar em producao. */
export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly current = new Map<string, string>();
  private readonly revoked = new Set<string>();
  private readonly byAccount = new Map<string, Set<string>>();

  startSession(
    sessionId: string,
    accountId: string,
    jti: string,
    _ttlSeconds: number,
  ): Promise<void> {
    this.revoked.delete(sessionId);
    this.current.set(sessionId, jti);
    const sessions = this.byAccount.get(accountId) ?? new Set<string>();
    sessions.add(sessionId);
    this.byAccount.set(accountId, sessions);
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

  revokeAllForAccount(accountId: string): Promise<void> {
    const sessions = this.byAccount.get(accountId);
    if (sessions) {
      for (const sessionId of sessions) {
        this.revoked.add(sessionId);
        this.current.delete(sessionId);
      }
      this.byAccount.delete(accountId);
    }
    return Promise.resolve();
  }

  isActive(sessionId: string): Promise<boolean> {
    return Promise.resolve(this.current.has(sessionId) && !this.revoked.has(sessionId));
  }
}

/**
 * Store de refresh tokens em Redis (producao — D-029). A rotacao e atomica via
 * Lua: compara o jti atual, detecta reuso e revoga a familia numa unica operacao
 * (sem corrida entre leitura e escrita). Cada sessao e indexada sob a conta para
 * permitir revogar todas as sessoes de uma vez (troca de senha).
 */
export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(
    private readonly redis: Redis,
    private readonly sessionPrefix = 'auth:session:',
    private readonly accountPrefix = 'auth:account:',
  ) {}

  private sessionKey(sessionId: string): string {
    return `${this.sessionPrefix}${sessionId}`;
  }

  private accountKey(accountId: string): string {
    return `${this.accountPrefix}${accountId}`;
  }

  async startSession(
    sessionId: string,
    accountId: string,
    jti: string,
    ttlSeconds: number,
  ): Promise<void> {
    const accountKey = this.accountKey(accountId);
    await this.redis
      .multi()
      .set(this.sessionKey(sessionId), jti, 'EX', ttlSeconds)
      .sadd(accountKey, sessionId)
      // O indice da conta expira com a sessao mais longa (auto-limpeza).
      .expire(accountKey, ttlSeconds)
      .exec();
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
      this.sessionKey(sessionId),
      oldJti,
      newJti,
      String(ttlSeconds),
    );
    return String(result) as RotateOutcome;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.redis.del(this.sessionKey(sessionId));
  }

  async revokeAllForAccount(accountId: string): Promise<void> {
    // Apaga toda a familia de sessoes da conta e o proprio indice, atomicamente.
    const script = `
      local sessions = redis.call('SMEMBERS', KEYS[1])
      for _, sid in ipairs(sessions) do
        redis.call('DEL', ARGV[1] .. sid)
      end
      redis.call('DEL', KEYS[1])
      return #sessions
    `;
    await this.redis.eval(script, 1, this.accountKey(accountId), this.sessionPrefix);
  }

  async isActive(sessionId: string): Promise<boolean> {
    return (await this.redis.exists(this.sessionKey(sessionId))) === 1;
  }
}

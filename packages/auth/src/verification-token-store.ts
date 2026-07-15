import { createHash, randomBytes } from 'node:crypto';

import type { Redis } from 'ioredis';

import type { IssuedVerificationToken, VerificationPurpose, VerificationTokenStore } from './types';

/** Gera um segredo opaco (256 bits) seguro para URL. */
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash de armazenamento — o token em claro nunca e persistido (D-029). */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Store em memoria — para testes e desenvolvimento local. Nao usar em producao. */
export class InMemoryVerificationTokenStore implements VerificationTokenStore {
  private readonly entries = new Map<string, { subject: string; expiresAtMs: number }>();

  private key(purpose: VerificationPurpose, hash: string): string {
    return `${purpose}:${hash}`;
  }

  issue(
    purpose: VerificationPurpose,
    subject: string,
    ttlSeconds: number,
  ): Promise<IssuedVerificationToken> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    this.entries.set(this.key(purpose, hashToken(token)), {
      subject,
      expiresAtMs: expiresAt.getTime(),
    });
    return Promise.resolve({ token, expiresAt });
  }

  consume(purpose: VerificationPurpose, token: string): Promise<string | null> {
    const key = this.key(purpose, hashToken(token));
    const entry = this.entries.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }
    // Uso unico: remove sempre que encontrado, mesmo se expirado.
    this.entries.delete(key);
    if (entry.expiresAtMs < Date.now()) {
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.subject);
  }
}

/**
 * Store de tokens de verificacao em Redis (producao — D-029). Guarda apenas o
 * hash do token com TTL; consumir usa GETDEL (atomico) para garantir uso unico
 * real, sem corrida entre leitura e remocao.
 */
export class RedisVerificationTokenStore implements VerificationTokenStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'auth:verify:',
  ) {}

  private key(purpose: VerificationPurpose, hash: string): string {
    return `${this.prefix}${purpose}:${hash}`;
  }

  async issue(
    purpose: VerificationPurpose,
    subject: string,
    ttlSeconds: number,
  ): Promise<IssuedVerificationToken> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.redis.set(this.key(purpose, hashToken(token)), subject, 'EX', ttlSeconds);
    return { token, expiresAt };
  }

  async consume(purpose: VerificationPurpose, token: string): Promise<string | null> {
    const subject = await this.redis.getdel(this.key(purpose, hashToken(token)));
    return subject ?? null;
  }
}

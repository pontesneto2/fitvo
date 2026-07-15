import {
  Argon2PasswordHasher,
  DefaultAuthService,
  InMemoryRefreshTokenStore,
  JwtTokenService,
} from '@fitvo/auth';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../app';
import { AuthApplicationService } from '../modules/auth/auth-application-service';
import { InMemoryAccountRepository } from '../modules/auth/in-memory-account-repository';

/** Monta a app com dependencias em memoria (sem Postgres/Redis) para testes. */
export function buildTestApp(): Promise<FastifyInstance> {
  const jwt = new JwtTokenService({
    accessSecret: 'test-access-secret-1234567890',
    refreshSecret: 'test-refresh-secret-1234567890',
    accessTtlSeconds: 900,
    refreshTtlSeconds: 3600,
    issuer: 'fitvo-test',
  });
  const authCore = new DefaultAuthService(jwt, new InMemoryRefreshTokenStore(), 3600);
  const authService = new AuthApplicationService(
    new InMemoryAccountRepository(),
    new Argon2PasswordHasher(),
    authCore,
  );
  return buildApp({ logLevel: 'silent', corsOrigin: '*', authService });
}

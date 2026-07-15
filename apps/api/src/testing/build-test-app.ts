import {
  Argon2PasswordHasher,
  DefaultAuthService,
  InMemoryRefreshTokenStore,
  InMemoryVerificationTokenStore,
  JwtTokenService,
} from '@fitvo/auth';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../app';
import { AuthApplicationService } from '../modules/auth/auth-application-service';
import { InMemoryAccountRepository } from '../modules/auth/in-memory-account-repository';
import { FakeAuthEmailSender } from './fake-auth-email-sender';

export interface TestHarness {
  app: FastifyInstance;
  emails: FakeAuthEmailSender;
}

/** Monta a app com dependencias em memoria (sem Postgres/Redis) e expoe o
 *  sender falso para asserts sobre os tokens "enviados". */
export async function buildTestHarness(): Promise<TestHarness> {
  const jwt = new JwtTokenService({
    accessSecret: 'test-access-secret-1234567890',
    refreshSecret: 'test-refresh-secret-1234567890',
    accessTtlSeconds: 900,
    refreshTtlSeconds: 3600,
    issuer: 'fitvo-test',
  });
  const authCore = new DefaultAuthService(jwt, new InMemoryRefreshTokenStore(), 3600);
  const emails = new FakeAuthEmailSender();
  const authService = new AuthApplicationService(
    new InMemoryAccountRepository(),
    new Argon2PasswordHasher(),
    authCore,
    new InMemoryVerificationTokenStore(),
    emails,
    { emailVerificationTtlSeconds: 3600, passwordResetTtlSeconds: 3600 },
  );
  const app = await buildApp({ logLevel: 'silent', corsOrigin: '*', authService });
  return { app, emails };
}

/** Atalho para os testes que so precisam da instancia da app. */
export function buildTestApp(): Promise<FastifyInstance> {
  return buildTestHarness().then((harness) => harness.app);
}

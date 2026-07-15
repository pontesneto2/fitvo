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
import { ClinicApplicationService } from '../modules/clinic/clinic-application-service';
import { InMemoryClinicRepository } from '../modules/clinic/in-memory-clinic-repository';
import { FakeAuthEmailSender } from './fake-auth-email-sender';

export interface TestHarness {
  app: FastifyInstance;
  emails: FakeAuthEmailSender;
  /** Repositorio de clinica em memoria — expoe `seed*` para arranjar clinicas/admins. */
  clinic: InMemoryClinicRepository;
}

/** Monta a app com dependencias em memoria (sem Postgres/Redis) e expoe o
 *  sender falso e o repositorio de clinica para arranjo/asserts nos testes. */
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
  const hasher = new Argon2PasswordHasher();
  const authService = new AuthApplicationService(
    new InMemoryAccountRepository(),
    hasher,
    authCore,
    new InMemoryVerificationTokenStore(),
    emails,
    { emailVerificationTtlSeconds: 3600, passwordResetTtlSeconds: 3600 },
  );
  const clinic = new InMemoryClinicRepository();
  const clinicService = new ClinicApplicationService(clinic, hasher, authCore, 3600);
  const app = await buildApp({ logLevel: 'silent', corsOrigin: '*', authService, clinicService });
  return { app, emails, clinic };
}

/** Atalho para os testes que so precisam da instancia da app. */
export function buildTestApp(): Promise<FastifyInstance> {
  return buildTestHarness().then((harness) => harness.app);
}

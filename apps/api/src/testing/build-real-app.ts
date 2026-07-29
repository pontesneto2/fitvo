import type { FastifyInstance } from 'fastify';

import { buildApp } from '../app';
import { buildProductionDependencies } from '../dependencies';
import type { ApiEnv } from '../env';

/**
 * Monta a app com dependencias REAIS (Prisma + Redis reais, via
 * `buildProductionDependencies`) — para os testes de integracao que precisam
 * do PIPELINE inteiro de verdade: hook de contexto de tenant (Slice 1) +
 * Prisma Client extension de isolamento (Slice 2, D-151) + repositorios
 * Prisma reais. `buildTestHarness` (in-memory) NAO serve pra isto: os
 * repositorios in-memory nao passam pelo Prisma Client, entao nunca
 * exercitam a extension.
 *
 * Exige `DATABASE_URL` (Postgres com as migracoes aplicadas) e Redis local —
 * mesma infra dos demais `*.integration.test.ts`. Segredos de teste fixos
 * (NAO usar em producao) — mesmo padrao de `buildTestDependencies`.
 */
export function buildRealTestApp(): Promise<FastifyInstance> {
  const env: ApiEnv = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    PORT: 3333,
    HOST: '0.0.0.0',
    CORS_ORIGIN: '*',
    DATABASE_URL: mustGetEnv('DATABASE_URL'),
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'integration-test-access-secret-1234567890',
    JWT_REFRESH_SECRET: 'integration-test-refresh-secret-1234567890',
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_TTL_SECONDS: 3600,
    JWT_ISSUER: 'fitvo-integration-test',
    EMAIL_VERIFICATION_TTL_SECONDS: 3600,
    PASSWORD_RESET_TTL_SECONDS: 3600,
    PROFESSIONAL_INVITE_TTL_SECONDS: 604_800,
    PATIENT_INVITE_TTL_SECONDS: 604_800,
    ASAAS_BASE_URL: 'https://sandbox.asaas.com/api/v3',
    S3_REGION: 'us-east-1',
    S3_FORCE_PATH_STYLE: false,
    ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
    AI_MODEL: 'claude-3-5-sonnet-latest',
  };

  const deps = buildProductionDependencies(env);
  return buildApp(deps);
}

function mustGetEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} nao definido — testes de integracao exigem Postgres real (ver docs/troubleshooting.md).`,
    );
  }
  return value;
}

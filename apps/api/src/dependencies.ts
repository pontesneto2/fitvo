import {
  Argon2PasswordHasher,
  DefaultAuthService,
  JwtTokenService,
  LoggingAuthEmailSender,
  RedisRefreshTokenStore,
  RedisVerificationTokenStore,
} from '@fitvo/auth';
import { prisma } from '@fitvo/database';
import { Redis } from 'ioredis';

import type { ApiEnv } from './env';
import { AuthApplicationService } from './modules/auth/auth-application-service';
import { PrismaAccountRepository } from './modules/auth/prisma-account-repository';

/** Dependencias injetadas na app (permite trocar por fakes nos testes). */
export interface AppDependencies {
  logLevel: string;
  corsOrigin: string;
  authService: AuthApplicationService;
  onClose?: () => Promise<void>;
}

/** Monta as dependencias reais (Prisma + Redis + Argon2 + JWT) a partir do env. */
export function buildProductionDependencies(env: ApiEnv): AppDependencies {
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const jwt = new JwtTokenService({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: env.JWT_REFRESH_TTL_SECONDS,
    issuer: env.JWT_ISSUER,
  });
  const authCore = new DefaultAuthService(
    jwt,
    new RedisRefreshTokenStore(redis),
    env.JWT_REFRESH_TTL_SECONDS,
  );
  // Stub de envio: registra o token no log estruturado (console = JSON de dev)
  // ate integrarmos um provedor real. O `console` satisfaz o sink `info(details,
  // message)` sem acoplar @fitvo/auth a uma implementacao concreta.
  const emailSender = new LoggingAuthEmailSender(console);
  const authService = new AuthApplicationService(
    new PrismaAccountRepository(prisma),
    new Argon2PasswordHasher(),
    authCore,
    new RedisVerificationTokenStore(redis),
    emailSender,
    {
      emailVerificationTtlSeconds: env.EMAIL_VERIFICATION_TTL_SECONDS,
      passwordResetTtlSeconds: env.PASSWORD_RESET_TTL_SECONDS,
    },
  );

  return {
    logLevel: env.LOG_LEVEL,
    corsOrigin: env.CORS_ORIGIN,
    authService,
    onClose: async () => {
      await redis.quit();
      await prisma.$disconnect();
    },
  };
}

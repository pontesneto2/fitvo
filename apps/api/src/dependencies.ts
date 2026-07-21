import {
  Argon2PasswordHasher,
  DefaultAuthService,
  JwtTokenService,
  LoggingAuthEmailSender,
  RedisRefreshTokenStore,
  RedisVerificationTokenStore,
} from '@fitvo/auth';
import { prisma } from '@fitvo/database';
import { type Logger, PinoLogger } from '@fitvo/observability';
import { AsaasPaymentGateway, FakePaymentGateway, type PaymentGateway } from '@fitvo/payments';
import { type BondCreatedEvent, BullMqQueueFactory, SHARING_QUEUE } from '@fitvo/queue';
import { Redis } from 'ioredis';

import type { ApiEnv } from './env';
import { AuthApplicationService } from './modules/auth/auth-application-service';
import { PrismaAccountRepository } from './modules/auth/prisma-account-repository';
import { BillingApplicationService } from './modules/billing/billing-application-service';
import { PrismaBillingRepository } from './modules/billing/prisma-billing-repository';
import { ClinicApplicationService } from './modules/clinic/clinic-application-service';
import { PrismaClinicRepository } from './modules/clinic/prisma-clinic-repository';
import { ConsentApplicationService } from './modules/consent/consent-application-service';
import { PrismaConsentRepository } from './modules/consent/prisma-consent-repository';
import { PatientApplicationService } from './modules/patient/patient-application-service';
import { PrismaPatientRepository } from './modules/patient/prisma-patient-repository';

/** Dependencias injetadas na app (permite trocar por fakes nos testes). */
export interface AppDependencies {
  logLevel: string;
  corsOrigin: string;
  authService: AuthApplicationService;
  clinicService: ClinicApplicationService;
  patientService: PatientApplicationService;
  consentService: ConsentApplicationService;
  billingService: BillingApplicationService;
  onClose?: () => Promise<void>;
}

/**
 * Escolhe o gateway de pagamento (ADR-0004). Com credenciais Asaas configuradas,
 * usa o adaptador LIVE; sem elas (caso deste repo publico), cai para o
 * FakePaymentGateway deterministico e registra um aviso claro. A app SEMPRE sobe.
 */
function buildPaymentGateway(env: ApiEnv, logger: Logger): PaymentGateway {
  if (env.ASAAS_API_KEY && env.ASAAS_WEBHOOK_SECRET) {
    return new AsaasPaymentGateway({
      apiKey: env.ASAAS_API_KEY,
      baseUrl: env.ASAAS_BASE_URL,
      webhookSecret: env.ASAAS_WEBHOOK_SECRET,
    });
  }
  logger.warn(
    'Asaas nao configurado (ASAAS_API_KEY/ASAAS_WEBHOOK_SECRET ausentes) — usando FakePaymentGateway.',
  );
  return new FakePaymentGateway();
}

/** Monta as dependencias reais (Prisma + Redis + Argon2 + JWT) a partir do env. */
export function buildProductionDependencies(env: ApiEnv): AppDependencies {
  // Logger estruturado (JSON) do adaptador de observabilidade — consumido aqui
  // para os avisos de boot (ex.: fallback do gateway quando o Asaas nao esta
  // configurado), no lugar de console cru.
  const logger = PinoLogger.create({ level: env.LOG_LEVEL, name: 'api' });
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  // Fabrica de filas BullMQ (D-017/D-026). A API atua como PRODUTOR: publica
  // bond.created na fila de compartilhamento; o worker consome (deteccao +
  // sugestao). Conexao Redis propria da fila (separada do Redis de auth).
  const queueFactory = new BullMqQueueFactory(env.REDIS_URL);
  const bondEvents = queueFactory.createQueue<BondCreatedEvent>(SHARING_QUEUE);
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
  // Stub de envio: registra APENAS o destinatario no log — nunca o token nem o
  // link (o link carrega o token). Placeholder ate integrarmos um provedor real.
  // O `console` satisfaz o sink `info(details, message)` sem acoplar @fitvo/auth
  // a uma implementacao concreta.
  const emailSender = new LoggingAuthEmailSender(console);
  const passwordHasher = new Argon2PasswordHasher();
  // Instancia unica reusada como EmailVerificationLookup (D-029) pelas demais
  // slices — evita repositorios de identidade duplicados so para checar
  // emailVerifiedAt no gate de acoes sensiveis (convidar/cobrar).
  const accountRepository = new PrismaAccountRepository(prisma);
  const authService = new AuthApplicationService(
    accountRepository,
    passwordHasher,
    authCore,
    new RedisVerificationTokenStore(redis),
    emailSender,
    {
      emailVerificationTtlSeconds: env.EMAIL_VERIFICATION_TTL_SECONDS,
      passwordResetTtlSeconds: env.PASSWORD_RESET_TTL_SECONDS,
    },
  );
  // authCore satisfaz AccessTokenVerifier (verifyAccessToken) — o guard de admin
  // da clinica reusa o mesmo verificador de access token da slice de auth.
  const clinicService = new ClinicApplicationService(
    new PrismaClinicRepository(prisma),
    passwordHasher,
    authCore,
    env.PROFESSIONAL_INVITE_TTL_SECONDS,
    accountRepository,
  );
  // authCore satisfaz AccessTokenVerifier — a slice de paciente reusa o mesmo
  // verificador de access token da slice de auth para o guard do profissional.
  const patientService = new PatientApplicationService(
    new PrismaPatientRepository(prisma),
    passwordHasher,
    authCore,
    env.PATIENT_INVITE_TTL_SECONDS,
    bondEvents,
    accountRepository,
  );
  // authCore satisfaz AccessTokenVerifier — a slice de consentimento reusa o
  // mesmo verificador de access token para o guard do paciente (titular).
  const consentService = new ConsentApplicationService(
    new PrismaConsentRepository(prisma),
    authCore,
  );
  // authCore satisfaz AccessTokenVerifier — a slice de billing reusa o mesmo
  // verificador. O gateway e Asaas (LIVE) ou Fake conforme a config (GATED).
  const billingService = new BillingApplicationService(
    new PrismaBillingRepository(prisma),
    buildPaymentGateway(env, logger),
    authCore,
    env.ASAAS_PLATFORM_WALLET_ID ?? null,
    accountRepository,
  );

  return {
    logLevel: env.LOG_LEVEL,
    corsOrigin: env.CORS_ORIGIN,
    authService,
    clinicService,
    patientService,
    consentService,
    billingService,
    onClose: async () => {
      await queueFactory.close();
      await redis.quit();
      await prisma.$disconnect();
    },
  };
}

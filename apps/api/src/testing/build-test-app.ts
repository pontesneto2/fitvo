import {
  Argon2PasswordHasher,
  DefaultAuthService,
  InMemoryRefreshTokenStore,
  InMemoryVerificationTokenStore,
  JwtTokenService,
} from '@fitvo/auth';
import { FakePaymentGateway } from '@fitvo/payments';
import { type BondCreatedEvent, InMemoryQueueFactory, SHARING_QUEUE } from '@fitvo/queue';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../app';
import type { AppDependencies } from '../dependencies';
import { AuthApplicationService } from '../modules/auth/auth-application-service';
import { InMemoryAccountRepository } from '../modules/auth/in-memory-account-repository';
import { BillingApplicationService } from '../modules/billing/billing-application-service';
import { InMemoryBillingRepository } from '../modules/billing/in-memory-billing-repository';
import { ClinicApplicationService } from '../modules/clinic/clinic-application-service';
import { InMemoryClinicRepository } from '../modules/clinic/in-memory-clinic-repository';
import { ConsentApplicationService } from '../modules/consent/consent-application-service';
import { InMemoryConsentRepository } from '../modules/consent/in-memory-consent-repository';
import { InMemoryPatientRepository } from '../modules/patient/in-memory-patient-repository';
import { PatientApplicationService } from '../modules/patient/patient-application-service';
import { InMemorySpecialtyRepository } from '../modules/specialty/in-memory-specialty-repository';
import { SpecialtyApplicationService } from '../modules/specialty/specialty-application-service';
import { InMemoryTermsRepository } from '../modules/terms/in-memory-terms-repository';
import { TermsApplicationService } from '../modules/terms/terms-application-service';
import { FakeAuthEmailSender } from './fake-auth-email-sender';

/** Dependências in-memory + os repositórios expostos para arranjo nos testes. */
export interface TestDependencies {
  deps: AppDependencies;
  emails: FakeAuthEmailSender;
  accounts: InMemoryAccountRepository;
  verificationTokens: InMemoryVerificationTokenStore;
  clinic: InMemoryClinicRepository;
  patient: InMemoryPatientRepository;
  consent: InMemoryConsentRepository;
  billing: InMemoryBillingRepository;
  terms: InMemoryTermsRepository;
  specialty: InMemorySpecialtyRepository;
  queue: InMemoryQueueFactory;
}

export interface TestHarness {
  app: FastifyInstance;
  emails: FakeAuthEmailSender;
  /** Repositorio de identidade em memoria — expoe `markEmailVerified` para arranjar contas verificadas (D-029). */
  accounts: InMemoryAccountRepository;
  /** Store de tokens de verificacao/recuperacao em memoria — permite semear tokens ja expirados (D-029). */
  verificationTokens: InMemoryVerificationTokenStore;
  /** Repositorio de clinica em memoria — expoe `seed*` para arranjar clinicas/admins. */
  clinic: InMemoryClinicRepository;
  /** Repositorio de paciente/vinculo em memoria — expoe `seed*` para arranjar profissionais/especialidades. */
  patient: InMemoryPatientRepository;
  /** Repositorio de consentimento em memoria — expoe `seed*` para arranjar pacientes/profissionais/vinculos. */
  consent: InMemoryConsentRepository;
  /** Repositorio de billing em memoria — expoe `seed*` para planos/subcontas/donos/vinculos. */
  billing: InMemoryBillingRepository;
  /** Repositorio de termos em memoria (D-025) — expoe `seedVersion`/`seedDefaultCatalog` e helpers de leitura de eventos para os testes. */
  terms: InMemoryTermsRepository;
  /** Catalogo de especialidades em memoria (D-047) — expoe `seed`/`seedDefaultCatalog`. */
  specialty: InMemorySpecialtyRepository;
  /** Fabrica de filas em memoria — coleta os eventos publicados (ex.: bond.created). */
  queue: InMemoryQueueFactory;
}

/**
 * Monta as dependências da app com implementações in-memory (sem Postgres/Redis)
 * e devolve também os repositórios/senders para arranjo e asserts. Separado de
 * `buildTestHarness` para que a app possa ser montada com opções (ex.: hook de
 * introspecção de rotas na trava de schema — D-032) reusando estas dependências.
 */
export function buildTestDependencies(): TestDependencies {
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
  // Repositorio de termos (D-025) semeado com o catalogo padrao (mesmo
  // conteudo da migracao de producao) — reusado como TermsAcceptanceLookup
  // pelas slices que ja aplicam requireVerifiedEmail, e pelo InMemoryAccountRepository
  // para escrever o aceite INICIAL no cadastro (mesma atomicidade da
  // PrismaAccountRepository, so que sobre Maps single-thread).
  const terms = new InMemoryTermsRepository();
  terms.seedDefaultCatalog();
  const termsService = new TermsApplicationService(terms, authCore);
  // Instancia unica reusada como EmailVerificationLookup (D-029) pelas demais
  // slices — mesmo padrao da producao (dependencies.ts): sem repositorio de
  // identidade duplicado so para o gate de acoes sensiveis. Recebe `terms`
  // para escrever os eventos ACCEPTED iniciais no cadastro (D-025).
  const accounts = new InMemoryAccountRepository(terms);
  const verificationTokens = new InMemoryVerificationTokenStore();
  // Catalogo fixo de especialidades (D-047), semeado com o mesmo conteudo da
  // migracao de producao — reusado como SpecialtyLookup pelo cadastro do
  // profissional autonomo (D-137).
  const specialty = new InMemorySpecialtyRepository();
  specialty.seedDefaultCatalog();
  const specialtyService = new SpecialtyApplicationService(specialty);
  const authService = new AuthApplicationService(
    accounts,
    hasher,
    authCore,
    verificationTokens,
    emails,
    { emailVerificationTtlSeconds: 3600, passwordResetTtlSeconds: 3600 },
    specialty,
  );
  const clinic = new InMemoryClinicRepository();
  const clinicService = new ClinicApplicationService(
    clinic,
    hasher,
    authCore,
    3600,
    accounts,
    termsService,
  );
  const queue = new InMemoryQueueFactory();
  const bondEvents = queue.createQueue<BondCreatedEvent>(SHARING_QUEUE);
  // Recebe `terms` para gravar o aceite inicial dos termos (D-025) e
  // `accounts` para que a conta criada no aceite de convite (D-135/ADR-0015)
  // seja visivel para login/verificacao de e-mail (mesma tabela `account`
  // unica que o Prisma usa em producao) — ver doc no construtor.
  const patient = new InMemoryPatientRepository(terms, accounts);
  const patientService = new PatientApplicationService(
    patient,
    hasher,
    authCore,
    3600,
    bondEvents,
    accounts,
    termsService,
  );
  const consent = new InMemoryConsentRepository();
  const consentService = new ConsentApplicationService(consent, authCore);
  const billing = new InMemoryBillingRepository();
  // Gateway Fake deterministico (sem Asaas). platformWalletId de teste habilita
  // a montagem de split quando a subconta tem walletId semeado.
  const billingService = new BillingApplicationService(
    billing,
    new FakePaymentGateway(),
    authCore,
    'wallet_fitvo_test',
    accounts,
    termsService,
  );
  return {
    deps: {
      logLevel: 'silent',
      corsOrigin: '*',
      authService,
      clinicService,
      patientService,
      consentService,
      termsService,
      billingService,
      specialtyService,
    },
    emails,
    accounts,
    verificationTokens,
    clinic,
    patient,
    consent,
    billing,
    terms,
    specialty,
    queue,
  };
}

/** Monta a app com dependencias em memoria (sem Postgres/Redis) e expoe o
 *  sender falso e os repositorios para arranjo/asserts nos testes. */
export async function buildTestHarness(): Promise<TestHarness> {
  const {
    deps,
    emails,
    accounts,
    verificationTokens,
    clinic,
    patient,
    consent,
    billing,
    terms,
    specialty,
    queue,
  } = buildTestDependencies();
  const app = await buildApp(deps);
  return {
    app,
    emails,
    accounts,
    verificationTokens,
    clinic,
    patient,
    consent,
    billing,
    terms,
    specialty,
    queue,
  };
}

/** Atalho para os testes que so precisam da instancia da app. */
export function buildTestApp(): Promise<FastifyInstance> {
  return buildTestHarness().then((harness) => harness.app);
}

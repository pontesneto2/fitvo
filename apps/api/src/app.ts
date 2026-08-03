import { randomUUID } from 'node:crypto';

import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from '@fitvo/observability';
import Fastify, { type FastifyInstance, type onRouteHookHandler } from 'fastify';

import type { AppDependencies } from './dependencies';
import { authRoutes } from './modules/auth/auth-routes';
import { billingRoutes } from './modules/billing/billing-routes';
import { clinicRoutes } from './modules/clinic/clinic-routes';
import { consentRoutes } from './modules/consent/consent-routes';
import { exerciseLibraryRoutes } from './modules/exercise-library/exercise-library-routes';
import { internRoutes } from './modules/intern/intern-routes';
import { nutritionRoutes } from './modules/nutrition/nutrition-routes';
import { patientRoutes } from './modules/patient/patient-routes';
import { receptionRoutes } from './modules/reception/reception-routes';
import { specialtyRoutes } from './modules/specialty/specialty-routes';
import { termsRoutes } from './modules/terms/terms-routes';
import { registerErrorHandler } from './shared/error-handler';
import { zodAwareTransform } from './shared/openapi-transform';
import { createTenantContextHook } from './shared/tenant-context-hook';

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Monta a instancia Fastify da API a partir das dependencias injetadas.
 * - Seguranca de sistema grande: Helmet, CORS restrito, rate limiting (D-033).
 * - Erros RFC 7807 (D-031); logger JSON + correlation ID (D-073).
 * - Slices em /v1: auth (/v1/auth), clinica (/v1/clinic), paciente/vinculo
 *   (/v1/patients), estagiario (/v1/interns — seat supervisionado, D-142),
 *   consentimento (/v1/consents), termos (/v1/terms — D-025;
 *   NAO confundir com /v1/consents), financeiro (/v1/billing — inclui o
 *   webhook publico do Asaas), o catalogo fixo de especialidades
 *   (/v1/specialties — publico, so-leitura, D-047) e nutricao (/v1/nutrition
 *   — montagem do plano alimentar, ADR-0013) e a biblioteca de exercicios
 *   (/v1/exercise-library — escopada por profissional, ADR-0009); /health e
 *   /docs (Swagger, D-032/D-034).
 */
export async function buildApp(
  deps: AppDependencies,
  options: { onRoute?: onRouteHookHandler } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: deps.logLevel },
    genReqId: (req) => firstHeader(req.headers[CORRELATION_ID_HEADER]) ?? randomUUID(),
  });

  // Seam de introspecção (registrado ANTES das rotas para capturá-las ao
  // carregar): usado pela trava "nenhuma rota sem schema" (D-032). No-op em prod.
  if (options.onRoute) {
    app.addHook('onRoute', options.onRoute);
  }

  // CSP desligada por ora para nao quebrar o Swagger UI; reavaliar na fase de UI.
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyCors, { origin: deps.corsOrigin });
  await app.register(fastifyRateLimit, { max: 100, timeWindow: '1 minute' });

  app.addHook('onRequest', (req, reply, done) => {
    reply.header(CORRELATION_ID_HEADER, req.id);
    reply.header(REQUEST_ID_HEADER, req.id);
    done();
  });

  // Contexto de tenant (D-150 — ADR-0017, Camada 1). Aditivo: so popula o
  // contexto quando ha token valido + `:tenantId` no path; nao consome nada
  // ainda (Slice 2 injeta o filtro na extension do Prisma).
  app.addHook('onRequest', createTenantContextHook(deps.tokenVerifier));

  registerErrorHandler(app);

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: 'FITVO API', version: '0.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    // D-032.1 (transitório): converte os schemas Zod (hoje, auth) para OpenAPI;
    // os slices ainda em JSON Schema passam intactos. Ver openapi-transform.ts.
    transform: zodAwareTransform,
  });
  await app.register(fastifySwaggerUi, { routePrefix: '/docs' });

  app.get('/health', () => ({
    status: 'ok' as const,
    service: 'api' as const,
    timestamp: new Date().toISOString(),
  }));

  await app.register(authRoutes(deps.authService), { prefix: '/v1/auth' });
  await app.register(clinicRoutes(deps.clinicService), { prefix: '/v1/clinic' });
  await app.register(internRoutes(deps.internService), { prefix: '/v1/interns' });
  await app.register(receptionRoutes(deps.receptionService), { prefix: '/v1/reception' });
  await app.register(patientRoutes(deps.patientService), { prefix: '/v1/patients' });
  await app.register(consentRoutes(deps.consentService), { prefix: '/v1/consents' });
  await app.register(termsRoutes(deps.termsService), { prefix: '/v1/terms' });
  await app.register(billingRoutes(deps.billingService), { prefix: '/v1/billing' });
  await app.register(specialtyRoutes(deps.specialtyService), { prefix: '/v1/specialties' });
  await app.register(nutritionRoutes(deps.nutritionService), { prefix: '/v1/nutrition' });
  await app.register(exerciseLibraryRoutes(deps.exerciseLibraryService), {
    prefix: '/v1/exercise-library',
  });

  if (deps.onClose) {
    const { onClose } = deps;
    app.addHook('onClose', () => onClose());
  }

  return app;
}

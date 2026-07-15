import { randomUUID } from 'node:crypto';

import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from '@fitvo/observability';
import Fastify, { type FastifyInstance } from 'fastify';

import type { AppDependencies } from './dependencies';
import { authRoutes } from './modules/auth/auth-routes';
import { clinicRoutes } from './modules/clinic/clinic-routes';
import { registerErrorHandler } from './shared/error-handler';

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Monta a instancia Fastify da API a partir das dependencias injetadas.
 * - Seguranca de sistema grande: Helmet, CORS restrito, rate limiting (D-033).
 * - Erros RFC 7807 (D-031); logger JSON + correlation ID (D-073).
 * - Slices em /v1: auth (/v1/auth) e clinica (/v1/clinic); /health e /docs
 *   (Swagger, D-032/D-034).
 */
export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: deps.logLevel },
    genReqId: (req) => firstHeader(req.headers[CORRELATION_ID_HEADER]) ?? randomUUID(),
  });

  // CSP desligada por ora para nao quebrar o Swagger UI; reavaliar na fase de UI.
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyCors, { origin: deps.corsOrigin });
  await app.register(fastifyRateLimit, { max: 100, timeWindow: '1 minute' });

  app.addHook('onRequest', (req, reply, done) => {
    reply.header(CORRELATION_ID_HEADER, req.id);
    reply.header(REQUEST_ID_HEADER, req.id);
    done();
  });

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
  });
  await app.register(fastifySwaggerUi, { routePrefix: '/docs' });

  app.get('/health', () => ({
    status: 'ok' as const,
    service: 'api' as const,
    timestamp: new Date().toISOString(),
  }));

  await app.register(authRoutes(deps.authService), { prefix: '/v1/auth' });
  await app.register(clinicRoutes(deps.clinicService), { prefix: '/v1/clinic' });

  if (deps.onClose) {
    const { onClose } = deps;
    app.addHook('onClose', () => onClose());
  }

  return app;
}

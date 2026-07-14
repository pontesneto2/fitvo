import { randomUUID } from 'node:crypto';

import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from '@fitvo/observability';
import Fastify, { type FastifyInstance } from 'fastify';

import { env } from './env';

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Monta a instancia Fastify da API.
 * - Logger estruturado (JSON) com nivel configuravel (D-073).
 * - Correlation ID propagado via header (gerado quando ausente).
 * - Stub de OpenAPI/Swagger em /docs (D-032).
 * - /health para health checks. Sem rota de dominio na Fase 1.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    genReqId: (req) => firstHeader(req.headers[CORRELATION_ID_HEADER]) ?? randomUUID(),
  });

  app.addHook('onRequest', (req, reply, done) => {
    reply.header(CORRELATION_ID_HEADER, req.id);
    reply.header(REQUEST_ID_HEADER, req.id);
    done();
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: 'FITVO API', version: '0.0.0' },
    },
  });
  await app.register(fastifySwaggerUi, { routePrefix: '/docs' });

  app.get('/health', () => ({
    status: 'ok' as const,
    service: 'api' as const,
    timestamp: new Date().toISOString(),
  }));

  return app;
}

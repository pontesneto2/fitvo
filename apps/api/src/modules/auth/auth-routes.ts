import type { FastifyPluginAsync } from 'fastify';

import { UnauthorizedError } from '../../shared/http-errors';
import type { AuthApplicationService } from './auth-application-service';
import {
  loginSchema,
  refreshSchema,
  registerPatientSchema,
  registerProfessionalSchema,
} from './auth-schemas';

function bearerToken(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acesso ausente ou malformado.');
  }
  return header.slice('Bearer '.length);
}

/**
 * Vertical slice de autenticacao (D-034: versao na URL /v1). Registro por papel
 * (D-045/D-006), login (rate limited — D-029), refresh (rotacao) e logout.
 */
export function authRoutes(service: AuthApplicationService): FastifyPluginAsync {
  return (app) => {
    app.post('/register/professional', async (request, reply) => {
      const body = registerProfessionalSchema.parse(request.body);
      return reply.code(201).send(await service.registerProfessional(body));
    });

    app.post('/register/patient', async (request, reply) => {
      const body = registerPatientSchema.parse(request.body);
      return reply.code(201).send(await service.registerPatient(body));
    });

    app.post(
      '/login',
      { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const body = loginSchema.parse(request.body);
        return reply.send(await service.login(body.email, body.password));
      },
    );

    app.post('/refresh', async (request, reply) => {
      const body = refreshSchema.parse(request.body);
      return reply.send({ tokens: await service.refresh(body.refreshToken) });
    });

    app.post('/logout', async (request, reply) => {
      await service.logout(bearerToken(request.headers.authorization));
      return reply.code(204).send();
    });

    return Promise.resolve();
  };
}

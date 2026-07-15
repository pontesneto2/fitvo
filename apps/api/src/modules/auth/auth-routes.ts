import type { FastifyPluginAsync } from 'fastify';

import { UnauthorizedError } from '../../shared/http-errors';
import type { AuthApplicationService } from './auth-application-service';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerPatientSchema,
  registerProfessionalSchema,
  requestEmailVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth-schemas';

const ACCEPTED = { status: 'accepted' as const };

function bearerToken(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acesso ausente ou malformado.');
  }
  return header.slice('Bearer '.length);
}

/**
 * Vertical slice de autenticacao (D-034: versao na URL /v1). Registro por papel
 * (D-045/D-006), login (rate limited — D-029), refresh (rotacao), logout,
 * verificacao de e-mail, recuperacao de senha e conta atual (/me).
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

    app.get('/me', async (request, reply) => {
      return reply.send(await service.getMe(bearerToken(request.headers.authorization)));
    });

    // (Re)envio da verificacao de e-mail — sempre 202 (nao vaza existencia).
    app.post(
      '/verify-email/request',
      { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const body = requestEmailVerificationSchema.parse(request.body);
        await service.requestEmailVerification(body.email);
        return reply.code(202).send(ACCEPTED);
      },
    );

    app.post('/verify-email', async (request, reply) => {
      const body = verifyEmailSchema.parse(request.body);
      await service.verifyEmail(body.token);
      return reply.send({ verified: true });
    });

    // Recuperacao de senha — sempre 202 (nao vaza existencia de conta).
    app.post(
      '/forgot-password',
      { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const body = forgotPasswordSchema.parse(request.body);
        await service.forgotPassword(body.email);
        return reply.code(202).send(ACCEPTED);
      },
    );

    app.post('/reset-password', async (request, reply) => {
      const body = resetPasswordSchema.parse(request.body);
      await service.resetPassword(body.token, body.password);
      return reply.code(204).send();
    });

    return Promise.resolve();
  };
}

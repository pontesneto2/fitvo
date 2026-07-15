import type { FastifyPluginAsync } from 'fastify';

import { extractBearerToken } from '../../shared/auth-context';
import type { AuthApplicationService } from './auth-application-service';
import {
  forgotPasswordRouteSchema,
  loginRouteSchema,
  logoutRouteSchema,
  meRouteSchema,
  refreshRouteSchema,
  registerPatientRouteSchema,
  registerProfessionalRouteSchema,
  requestEmailVerificationRouteSchema,
  resetPasswordRouteSchema,
  verifyEmailRouteSchema,
} from './auth-openapi';
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

/**
 * Vertical slice de autenticacao (D-034: versao na URL /v1). Registro por papel
 * (D-045/D-006), login (rate limited — D-029), refresh (rotacao), logout,
 * verificacao de e-mail, recuperacao de senha e conta atual (/me). Rotas
 * documentadas no OpenAPI/Swagger (D-032); Zod valida o corpo nos handlers.
 */
export function authRoutes(service: AuthApplicationService): FastifyPluginAsync {
  return (app) => {
    app.post(
      '/register/professional',
      { schema: registerProfessionalRouteSchema },
      async (request, reply) => {
        const body = registerProfessionalSchema.parse(request.body);
        return reply.code(201).send(await service.registerProfessional(body));
      },
    );

    app.post(
      '/register/patient',
      { schema: registerPatientRouteSchema },
      async (request, reply) => {
        const body = registerPatientSchema.parse(request.body);
        return reply.code(201).send(await service.registerPatient(body));
      },
    );

    app.post(
      '/login',
      { schema: loginRouteSchema, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
      async (request, reply) => {
        const body = loginSchema.parse(request.body);
        return reply.send(await service.login(body.email, body.password));
      },
    );

    app.post('/refresh', { schema: refreshRouteSchema }, async (request, reply) => {
      const body = refreshSchema.parse(request.body);
      return reply.send({ tokens: await service.refresh(body.refreshToken) });
    });

    app.post('/logout', { schema: logoutRouteSchema }, async (request, reply) => {
      await service.logout(extractBearerToken(request.headers.authorization));
      return reply.code(204).send();
    });

    app.get('/me', { schema: meRouteSchema }, async (request, reply) => {
      return reply.send(await service.getMe(extractBearerToken(request.headers.authorization)));
    });

    // (Re)envio da verificacao de e-mail — sempre 202 (nao vaza existencia).
    app.post(
      '/verify-email/request',
      {
        schema: requestEmailVerificationRouteSchema,
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        const body = requestEmailVerificationSchema.parse(request.body);
        await service.requestEmailVerification(body.email);
        return reply.code(202).send(ACCEPTED);
      },
    );

    app.post('/verify-email', { schema: verifyEmailRouteSchema }, async (request, reply) => {
      const body = verifyEmailSchema.parse(request.body);
      await service.verifyEmail(body.token);
      return reply.send({ verified: true });
    });

    // Recuperacao de senha — sempre 202 (nao vaza existencia de conta).
    app.post(
      '/forgot-password',
      {
        schema: forgotPasswordRouteSchema,
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        const body = forgotPasswordSchema.parse(request.body);
        await service.forgotPassword(body.email);
        return reply.code(202).send(ACCEPTED);
      },
    );

    app.post('/reset-password', { schema: resetPasswordRouteSchema }, async (request, reply) => {
      const body = resetPasswordSchema.parse(request.body);
      await service.resetPassword(body.token, body.password);
      return reply.code(204).send();
    });

    return Promise.resolve();
  };
}

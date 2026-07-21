import type { AuthTokens } from '@fitvo/auth';
import {
  acceptedResultSchema,
  type AuthResult as AuthResultDto,
  authResultSchema,
  emailVerifiedResultSchema,
  forgotPasswordSchema,
  loginSchema,
  meResultSchema,
  refreshResultSchema,
  refreshSchema,
  registerPatientSchema,
  registerProfessionalSchema,
  requestEmailVerificationSchema,
  resetPasswordSchema,
  type Tokens as TokensDto,
  verifyEmailSchema,
} from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { extractBearerToken } from '../../shared/auth-context';
import type { AuthApplicationService, AuthResult } from './auth-application-service';

const ACCEPTED = { status: 'accepted' } as const;
const TAGS = ['auth'];

/**
 * Timestamps do domínio (`Date`) → ISO string no fio. O `fast-json-stringify`
 * fazia isto escondido via `format: date-time`; o serializer do Zod não converte
 * `Date` sozinho, então a ponte é explícita aqui, no boundary (D-032).
 */
function toTokensDto(tokens: AuthTokens): TokensDto {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: tokens.accessExpiresAt.toISOString(),
    refreshExpiresAt: tokens.refreshExpiresAt.toISOString(),
  };
}

function toAuthResultDto(result: AuthResult): AuthResultDto {
  return { account: result.account, tokens: toTokensDto(result.tokens) };
}

/**
 * Origem da requisicao de cadastro (D-025) — IP/UA vem SEMPRE da requisicao,
 * nunca do corpo enviado pelo cliente (o body so carrega os literais `true`
 * do `acceptedTerms`, que o Zod ja validou antes deste handler rodar).
 */
function registrationOrigin(request: {
  ip: string;
  headers: Record<string, string | string[] | undefined>;
}): { ipAddress: string; userAgent: string } {
  const userAgent = request.headers['user-agent'];
  return {
    ipAddress: request.ip,
    userAgent: (Array.isArray(userAgent) ? userAgent[0] : userAgent) ?? 'unknown',
  };
}

/**
 * Vertical slice de autenticacao (D-034: versao na URL /v1). Registro por papel
 * (D-045/D-006), login (rate limited — D-029), refresh (rotacao), logout,
 * verificacao de e-mail, recuperacao de senha e conta atual (/me).
 *
 * D-032: os schemas Zod de `@fitvo/validation` são a FONTE ÚNICA — validam o
 * request E geram o OpenAPI (via `fastify-type-provider-zod`). O validador e o
 * serializer Zod são setados AQUI, no contexto encapsulado deste slice: os
 * demais slices seguem em AJV/JSON Schema até a D-032.2.
 */
export function authRoutes(service: AuthApplicationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.post(
      '/register/professional',
      {
        schema: {
          tags: TAGS,
          summary: 'Cadastra um profissional (cria conta + tenant SOLO)',
          description:
            'Cria conta + tenant SOLO + perfil profissional (D-045) e dispara a verificacao de e-mail.',
          body: registerProfessionalSchema,
          response: { 201: authResultSchema },
        },
      },
      async (request, reply) => {
        return reply.code(201).send(
          toAuthResultDto(
            await service.registerProfessional({
              ...request.body,
              termsAcceptance: registrationOrigin(request),
            }),
          ),
        );
      },
    );

    app.post(
      '/register/patient',
      {
        schema: {
          tags: TAGS,
          summary: 'Cadastra um paciente (conta em estado minimo)',
          description: 'Autocadastro de paciente (D-006); dispara a verificacao de e-mail.',
          body: registerPatientSchema,
          response: { 201: authResultSchema },
        },
      },
      async (request, reply) => {
        return reply.code(201).send(
          toAuthResultDto(
            await service.registerPatient({
              ...request.body,
              termsAcceptance: registrationOrigin(request),
            }),
          ),
        );
      },
    );

    app.post(
      '/login',
      {
        schema: {
          tags: TAGS,
          summary: 'Autentica por e-mail e senha (rate limited)',
          description: 'Emite access + refresh (D-029). Limitado a 5 tentativas por minuto.',
          body: loginSchema,
          response: { 200: authResultSchema },
        },
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        return reply.send(
          toAuthResultDto(await service.login(request.body.email, request.body.password)),
        );
      },
    );

    app.post(
      '/refresh',
      {
        schema: {
          tags: TAGS,
          summary: 'Rotaciona o refresh token',
          description: 'Rotacao a cada uso com deteccao de reuso (D-029).',
          body: refreshSchema,
          response: { 200: refreshResultSchema },
        },
      },
      async (request, reply) => {
        return reply.send({
          tokens: toTokensDto(await service.refresh(request.body.refreshToken)),
        });
      },
    );

    app.post(
      '/logout',
      {
        schema: {
          tags: TAGS,
          summary: 'Encerra a sessao atual (revoga o refresh)',
          security: [{ bearerAuth: [] }],
        },
      },
      async (request, reply) => {
        await service.logout(extractBearerToken(request.headers.authorization));
        return reply.code(204).send();
      },
    );

    app.get(
      '/me',
      {
        schema: {
          tags: TAGS,
          summary: 'Conta autenticada (a partir do access token)',
          security: [{ bearerAuth: [] }],
          response: { 200: meResultSchema },
        },
      },
      async (request, reply) => {
        return reply.send(await service.getMe(extractBearerToken(request.headers.authorization)));
      },
    );

    // (Re)envio da verificacao de e-mail — sempre 202 (nao vaza existencia).
    app.post(
      '/verify-email/request',
      {
        schema: {
          tags: TAGS,
          summary: 'Solicita/reenvia a verificacao de e-mail',
          description:
            'Sempre 202 — nao revela se o e-mail existe ou ja esta verificado (D-029). Rate limited.',
          body: requestEmailVerificationSchema,
          response: { 202: acceptedResultSchema },
        },
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        await service.requestEmailVerification(request.body.email);
        return reply.code(202).send(ACCEPTED);
      },
    );

    app.post(
      '/verify-email',
      {
        schema: {
          tags: TAGS,
          summary: 'Confirma a verificacao de e-mail (consome o token)',
          body: verifyEmailSchema,
          response: { 200: emailVerifiedResultSchema },
        },
      },
      async (request, reply) => {
        await service.verifyEmail(request.body.token);
        return reply.send({ verified: true });
      },
    );

    // Recuperacao de senha — sempre 202 (nao vaza existencia de conta).
    app.post(
      '/forgot-password',
      {
        schema: {
          tags: TAGS,
          summary: 'Inicia a recuperacao de senha',
          description: 'Sempre 202 — nao vaza existencia de conta (D-029). Rate limited.',
          body: forgotPasswordSchema,
          response: { 202: acceptedResultSchema },
        },
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        await service.forgotPassword(request.body.email);
        return reply.code(202).send(ACCEPTED);
      },
    );

    app.post(
      '/reset-password',
      {
        schema: {
          tags: TAGS,
          summary: 'Redefine a senha e revoga as sessoes',
          description: 'Consome o token de uso unico e revoga todas as sessoes da conta (D-029).',
          body: resetPasswordSchema,
        },
      },
      async (request, reply) => {
        await service.resetPassword(request.body.token, request.body.password);
        return reply.code(204).send();
      },
    );
  };
}

import type { AuthTokens } from '@fitvo/auth';
import {
  acceptedResultSchema,
  type AuthResult as AuthResultDto,
  authResultSchema,
  completeProfileSchema,
  emailVerifiedResultSchema,
  forgotPasswordSchema,
  loginSchema,
  meResultSchema,
  problemDetailsSchema,
  refreshResultSchema,
  refreshSchema,
  registerAcademySchema,
  registerClinicSchema,
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
 * Vertical slice de autenticacao (D-034: versao na URL /v1). Cadastro de
 * profissional (D-045; paciente nao se autocadastra — D-135/ADR-0015, nasce
 * so pelo aceite de convite na slice `patient`), login (rate limited —
 * D-029), refresh (rotacao), logout, verificacao de e-mail, recuperacao de
 * senha e conta atual (/me).
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
      '/register/clinic',
      {
        schema: {
          tags: TAGS,
          summary: 'Cadastra uma clínica (cria tenant CLINIC + admin)',
          description:
            'Cadastro público de clínica (D-139): cria Tenant(CLINIC) + Account(admin) + membership CLINIC_ADMIN (+ perfil profissional se "também atende") e dispara a verificacao de e-mail.',
          body: registerClinicSchema,
          response: { 201: authResultSchema },
        },
      },
      async (request, reply) => {
        return reply
          .code(201)
          .send(
            toAuthResultDto(
              await service.registerClinic(request.body, registrationOrigin(request)),
            ),
          );
      },
    );

    app.post(
      '/register/academy',
      {
        schema: {
          tags: TAGS,
          summary: 'Cadastra uma academia (cria tenant ACADEMIA + admin)',
          description:
            'Cadastro público de academia (D-141): MESMO cadastro da clínica (spec §4.2/§4.3) — cria Tenant(ACADEMIA) + Account(admin) + membership CLINIC_ADMIN (+ perfil profissional se "também atende") e dispara a verificacao de e-mail. Profissões: SÓ CREF (Educador Físico / Personal Trainer); Médico e Nutricionista são rejeitados com 400 na borda.',
          body: registerAcademySchema,
          response: { 201: authResultSchema },
        },
      },
      async (request, reply) => {
        return reply
          .code(201)
          .send(
            toAuthResultDto(
              await service.registerAcademy(request.body, registrationOrigin(request)),
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

    /**
     * Gate de completar-perfil (spec §5) — a pessoa preenche o que falta e
     * recebe o `/me` JA recalculado, sem precisar de um segundo round-trip
     * para saber se destravou.
     *
     * PATCH, nao PUT: e preenchimento PARCIAL do que falta. Nao ha `:tenantId`
     * de proposito — `Account` e a PESSOA (D-044), nao o papel; a mesma conta
     * pode ter seats em varias empresas e o nascimento dela e um so. O Bearer
     * ja diz de quem e a conta: ninguem completa o perfil de outra pessoa.
     */
    app.patch(
      '/me/complete-profile',
      {
        schema: {
          tags: TAGS,
          summary: 'Completa os campos faltantes do perfil (gate pos-login — spec §5)',
          description:
            'Preenche nascimento/WhatsApp de quem foi pre-cadastrado por terceiro sem esses ' +
            'dados, e devolve o `/me` com `profileComplete` recalculado. Sao os campos do ' +
            'MINIMO FUNCIONAL (D-157) — endereco NAO entra: saiu do minimo e vira pedido ' +
            'contextual. Cada campo e validado com o MESMO rigor do cadastro (maioridade, ' +
            'so digitos) — nao ha versao relaxada. Campos ausentes NAO sao zerados. Nao ' +
            'regrava termos (D-025) nem altera documento/e-mail. Idempotente.',
          security: [{ bearerAuth: [] }],
          body: completeProfileSchema,
          response: { 200: meResultSchema, 401: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        return reply.send(
          await service.completeProfile(extractBearerToken(request.headers.authorization), {
            whatsapp: request.body.whatsapp,
            // `YYYY-MM-DD` -> Date UTC midnight (calendario, sem hora) — mesma
            // ponte do cadastro; o schema ja validou formato e maioridade.
            birthDate:
              request.body.birthDate === undefined
                ? undefined
                : new Date(`${request.body.birthDate}T00:00:00Z`),
          }),
        );
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

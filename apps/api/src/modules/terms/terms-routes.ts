import { acceptTermsSchema, revokeTermsSchema, termsStatusResultSchema } from '@fitvo/validation';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { TermsApplicationService } from './terms-application-service';

const TAGS = ['terms'];
const bearerAuth = [{ bearerAuth: [] }];

/** Origem da requisicao (D-025) — IP/UA vem SEMPRE da requisicao, nunca do body. */
function requestOrigin(request: FastifyRequest): { ipAddress: string; userAgent: string } {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'] ?? 'unknown',
  };
}

/**
 * Vertical slice de termos (D-025 — LGPD; versao na URL /v1 — D-034). O
 * aceite INICIAL (cadastro) acontece na slice `auth`, na mesma transacao de
 * criacao da conta; esta slice cobre a CONSULTA do status atual e o
 * re-consentimento/revogacao POSTERIORES. NAO confundir com `/v1/consents`
 * (compartilhamento clinico entre profissionais — ADR-0003/D-016).
 *
 * D-032: schemas Zod de `@fitvo/validation` sao a fonte unica (validam + geram
 * o OpenAPI). Compilers Zod escopados a este slice (contexto encapsulado).
 */
export function termsRoutes(service: TermsApplicationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.get(
      '/status',
      {
        schema: {
          tags: TAGS,
          summary: 'Status de aceite dos documentos de termos da conta autenticada',
          description:
            'Um status por documento do catalogo (Termos de Uso, Politica de ' +
            'Privacidade): CURRENT ou RECONSENT_REQUIRED (D-025). Derivado do ' +
            'historico append-only de eventos — nunca guardado de forma mutavel.',
          security: bearerAuth,
          response: { 200: termsStatusResultSchema },
        },
      },
      async (request, reply) => {
        const documents = await service.getStatus(request.headers.authorization);
        return reply.send({ documents });
      },
    );

    app.post(
      '/accept',
      {
        schema: {
          tags: TAGS,
          summary: 'Re-consentimento: aceita a versao atual publicada de um documento',
          description:
            'Escreve um novo evento ACCEPTED (append-only) contra a versao ATUAL ' +
            'publicada do documento (D-025). Usado apos RECONSENT_REQUIRED.',
          security: bearerAuth,
          body: acceptTermsSchema,
        },
      },
      async (request, reply) => {
        await service.accept(
          request.headers.authorization,
          request.body.slug,
          requestOrigin(request),
        );
        return reply.code(204).send();
      },
    );

    app.post(
      '/revoke',
      {
        schema: {
          tags: TAGS,
          summary: 'Revoga o aceite de um documento de termos',
          description:
            'Escreve um novo evento REVOKED (append-only) — a conta passa a exigir ' +
            're-consentimento (D-025) em qualquer acao gated ate aceitar de novo.',
          security: bearerAuth,
          body: revokeTermsSchema,
        },
      },
      async (request, reply) => {
        await service.revoke(
          request.headers.authorization,
          request.body.slug,
          requestOrigin(request),
        );
        return reply.code(204).send();
      },
    );
  };
}

import type { FastifyRequest, onRequestHookHandler } from 'fastify';

import type { AccessTokenVerifier } from './auth-context';
import { extractBearerToken } from './auth-context';
import { runWithTenantContext } from './tenant-context';

/**
 * Le o `tenantId` da MESMA fonte que cada rota ja usa hoje para autorizacao:
 * o path param `:tenantId` (ver clinic/intern/reception/patient/billing-routes).
 * Este hook so LE o valor cru do path — nao valida que o accountId pertence a
 * esse tenant (essa validacao ja existe, adiante, em cada application-service,
 * e continua exatamente como esta; D-150 nao a duplica nem a antecipa).
 *
 * NOTA CRITICA para o Slice 2 (D-151, Prisma extension): como o `tenantId` do
 * contexto vem do path — controlado pelo cliente — e o contexto e aberto ANTES
 * da validacao accountId<->tenantId (que so roda depois, dentro do service), a
 * extension do Slice 2 SO pode confiar nesse contexto para filtrar query DEPOIS
 * que essa validacao de pertencimento já rodou. Se a extension filtrar antes
 * (ou em rota que pule a validacao), um path `:tenantId` de outro tenant faria
 * a extension escopar a query pelo tenant ERRADO — nao um vazamento cross-tenant
 * classico, mas um acesso indevido por confiar cegamente no path. Premissa nº1
 * do Slice 2: garantir que a validacao de pertencimento roda antes de qualquer
 * query sensivel que dependa do contexto. Neste Slice 1 isso e inofensivo — o
 * contexto e aditivo e ninguem o consome ainda.
 */
function extractTenantIdParam(request: FastifyRequest): string | undefined {
  const params = request.params;
  if (params && typeof params === 'object' && 'tenantId' in params) {
    const value = (params as Record<string, unknown>).tenantId;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
  return undefined;
}

/**
 * Hook `onRequest` que abre o contexto de tenant (D-150) para requisicoes
 * autenticadas com `:tenantId` no path. Deliberadamente NUNCA chama
 * `done(err)`: este hook so popula contexto quando da, nunca vira gate de auth
 * novo — token ausente/invalido/malformado, ou rota sem `:tenantId` (registro
 * publico, aceite de convite, login/refresh, /me, /consents, /terms, webhook
 * Asaas, catalogo de especialidades, /health), seguem exatamente como hoje,
 * sem contexto de tenant, e a autenticacao/autorizacao real de cada rota
 * (requireAuth dentro do proprio service) roda depois, inalterada.
 */
export function createTenantContextHook(tokenVerifier: AccessTokenVerifier): onRequestHookHandler {
  return (request, _reply, done) => {
    const authorizationHeader = request.headers.authorization;
    if (!authorizationHeader) {
      done();
      return;
    }

    let token: string;
    try {
      token = extractBearerToken(authorizationHeader);
    } catch {
      done();
      return;
    }

    tokenVerifier
      .verifyAccessToken(token)
      .then(() => {
        const tenantId = extractTenantIdParam(request);
        if (tenantId) {
          runWithTenantContext(tenantId, done);
        } else {
          done();
        }
      })
      .catch(() => done());
  };
}

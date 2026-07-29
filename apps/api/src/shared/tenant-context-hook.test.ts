import { getTenantContext } from '@fitvo/database';
import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildTestApp } from '../testing/build-test-app';
import { validProfessionalRegistration } from '../testing/professional-registration-fixture';

/**
 * Rotas de sonda so para este teste: registradas diretamente na instancia da
 * app ANTES do primeiro `.inject()` (Fastify aceita novas rotas ate a
 * primeira chamada disparar `ready()`). Nao tocam nenhuma rota de producao —
 * `app.ts` nao conhece nem registra estas rotas.
 */
function registerProbeRoutes(app: FastifyInstance): void {
  app.get<{ Params: { tenantId: string }; Querystring: { delayMs?: string } }>(
    '/__test/tenant-probe/:tenantId',
    async (request) => {
      const delayMs = Number(request.query.delayMs ?? 0);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return { tenantId: getTenantContext() ?? null };
    },
  );

  app.get('/__test/no-tenant-probe', async () => ({ tenantId: getTenantContext() ?? null }));
}

async function registerAndGetToken(app: FastifyInstance, email: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: { ...validProfessionalRegistration, email },
  });
  expect(response.statusCode).toBe(201);
  return response.json().tokens.accessToken as string;
}

describe('tenant-context-hook (via pipeline real)', () => {
  it('requisicao autenticada com :tenantId no path expoe o tenantId dentro do handler, mesmo apos await', async () => {
    const app = await buildTestApp();
    registerProbeRoutes(app);
    const token = await registerAndGetToken(app, 'hook-basico@fitvo.dev');

    const probe = await app.inject({
      method: 'GET',
      url: '/__test/tenant-probe/tenant-alpha?delayMs=5',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(probe.statusCode).toBe(200);
    expect(probe.json()).toEqual({ tenantId: 'tenant-alpha' });

    await app.close();
  });

  it('requisicao autenticada SEM :tenantId no path nao abre contexto (ex.: /me, /consents, /terms)', async () => {
    const app = await buildTestApp();
    registerProbeRoutes(app);
    const token = await registerAndGetToken(app, 'hook-sem-tenant@fitvo.dev');

    const probe = await app.inject({
      method: 'GET',
      url: '/__test/no-tenant-probe',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(probe.statusCode).toBe(200);
    expect(probe.json()).toEqual({ tenantId: null });

    await app.close();
  });

  it('requisicao sem sessao (rota publica) nao abre contexto, mesmo com :tenantId no path', async () => {
    const app = await buildTestApp();
    registerProbeRoutes(app);

    const probe = await app.inject({ method: 'GET', url: '/__test/tenant-probe/tenant-alpha' });

    expect(probe.statusCode).toBe(200);
    expect(probe.json()).toEqual({ tenantId: null });

    await app.close();
  });

  it('token invalido nao quebra a requisicao nem abre contexto (hook nunca chama done(err))', async () => {
    const app = await buildTestApp();
    registerProbeRoutes(app);

    const probe = await app.inject({
      method: 'GET',
      url: '/__test/tenant-probe/tenant-alpha',
      headers: { authorization: 'Bearer token-invalido-e-malformado' },
    });

    expect(probe.statusCode).toBe(200);
    expect(probe.json()).toEqual({ tenantId: null });

    await app.close();
  });

  it('duas requisicoes concorrentes de tenants diferentes nao vazam contexto entre si', async () => {
    const app = await buildTestApp();
    registerProbeRoutes(app);
    const [tokenA, tokenB] = await Promise.all([
      registerAndGetToken(app, 'hook-concorrente-a@fitvo.dev'),
      registerAndGetToken(app, 'hook-concorrente-b@fitvo.dev'),
    ]);

    const [probeA, probeB] = await Promise.all([
      app.inject({
        method: 'GET',
        // Atraso maior na requisicao A: se o contexto vazasse, A leria o
        // tenant de B (que teria concluido primeiro e "restaurado" o ALS).
        url: '/__test/tenant-probe/tenant-x?delayMs=30',
        headers: { authorization: `Bearer ${tokenA}` },
      }),
      app.inject({
        method: 'GET',
        url: '/__test/tenant-probe/tenant-y?delayMs=5',
        headers: { authorization: `Bearer ${tokenB}` },
      }),
    ]);

    expect(probeA.json()).toEqual({ tenantId: 'tenant-x' });
    expect(probeB.json()).toEqual({ tenantId: 'tenant-y' });

    await app.close();
  });
});

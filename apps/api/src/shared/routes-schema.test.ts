import { describe, expect, it } from 'vitest';

import { buildApp } from '../app';
import { buildTestDependencies } from '../testing/build-test-app';

/**
 * Trava do D-032: nenhuma rota sem `schema`. Um endpoint sem schema não é
 * validado nem documentado — é o próximo "verde que mente" esperando acontecer
 * (a request entra sem contrato e nada reprova).
 *
 * O hook `onRoute` é passado ao `buildApp` e registrado ANTES das rotas, então
 * captura toda rota que carrega. A asserção `allRoutes` é a ÂNCORA: se o hook
 * não visse rota nenhuma, `routesWithoutSchema` ficaria vazio por VACUIDADE e o
 * teste passaria sem provar nada — a âncora faz o teste falhar nesse caso
 * (troubleshooting §6).
 */
describe('Contrato de rotas (D-032)', () => {
  it('toda rota registrada declara um schema', async () => {
    const { deps } = buildTestDependencies();

    const allRoutes: string[] = [];
    const routesWithoutSchema: string[] = [];
    const app = await buildApp(deps, {
      onRoute: (route) => {
        allRoutes.push(`${String(route.method)} ${route.url}`);
        // /health e o Swagger UI (/docs) não são contrato de API — dispensados.
        const exempt = route.url === '/health' || route.url.startsWith('/docs');
        const hasSchema = route.schema !== undefined && Object.keys(route.schema).length > 0;
        if (!exempt && !hasSchema) {
          routesWithoutSchema.push(`${String(route.method)} ${route.url}`);
        }
      },
    });
    await app.ready();
    await app.close();

    // ÂNCORA: prova que o hook exercitou as rotas (senão o teste é vácuo).
    expect(allRoutes.length).toBeGreaterThan(20);
    expect(routesWithoutSchema).toEqual([]);
  });
});

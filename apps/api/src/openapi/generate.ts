import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTestHarness } from '../testing/build-test-app';

/**
 * Gera o OpenAPI da API (D-032) e escreve em `@fitvo/contracts/openapi.json`.
 *
 * O spec é DERIVADO dos schemas Zod das rotas (via `fastify-type-provider-zod`),
 * não escrito à mão — logo não pode divergir do que a rota valida. A app é
 * montada com as dependências in-memory dos testes: o spec depende do CÓDIGO
 * (rotas + schemas), não da infra, e é determinístico. O job `contract` do CI
 * regenera e faz `diff` contra o arquivo commitado — reprova contrato defasado.
 */
const OUTPUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/contracts/openapi.json',
);

async function generate(): Promise<void> {
  const { app } = await buildTestHarness();
  try {
    await app.ready();
    const spec = app.swagger();
    await writeFile(OUTPUT, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  } finally {
    await app.close();
  }
  process.stdout.write(`OpenAPI gerado em ${OUTPUT}\n`);
}

generate().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});

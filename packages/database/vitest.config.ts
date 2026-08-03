import { defineConfig } from 'vitest/config';

/**
 * Testes UNITARIOS do pacote (sem banco). Mesma separacao de apps/api: os
 * `.integration.test.ts` exigem Postgres real e rodam pela
 * `vitest.integration.config.ts` no job `migrate`; incluir aqui deixaria o job
 * `test` vermelho por falta de infra, nao por defeito.
 */
export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
  },
});

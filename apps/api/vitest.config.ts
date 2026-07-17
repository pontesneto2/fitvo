import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.ts'],
    // Integracao exige Postgres real e roda no job `migrate` (que ja sobe o
    // banco). O job `test` NAO toca banco: sem este exclude, ficaria vermelho
    // por falta de infra em vez de por defeito.
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
  },
});

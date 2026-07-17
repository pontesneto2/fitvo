import { defineConfig } from 'vitest/config';

/**
 * Testes de INTEGRACAO: exigem Postgres real (`DATABASE_URL`) com as migracoes
 * aplicadas. Config separada de proposito — o job `test` do CI nao toca banco, e
 * incluir estes ali deixaria o CI vermelho por falta de infra, nao por defeito.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    // Sequencial: os testes compartilham o mesmo banco. Em paralelo, o seed de um
    // enxergaria o do outro e a leitura viraria loteria.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});

import { defineConfig } from 'vitest/config';

/** Ver packages/database/vitest.integration.config.ts. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});

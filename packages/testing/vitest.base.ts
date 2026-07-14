import { defineConfig } from 'vitest/config';

/** Config base de Vitest compartilhada pelos pacotes e apps (D-070). */
export const baseConfig = defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
    },
  },
});

export default baseConfig;

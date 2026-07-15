import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom: os testes de componente (button.test.tsx) renderizam via
    // @testing-library/react. Os testes de logica (glue) tambem rodam aqui.
    environment: 'jsdom',
    passWithNoTests: true,
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});

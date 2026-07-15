import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Apenas a logica pura (button-variants) roda aqui — sem react-native. Testes
    // de renderizacao RN exigem harness proprio (jest + preset RN), decisao de
    // infra separada; a decisao de cor/dimensao, que e o que importa, fica coberta.
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.ts'],
  },
});

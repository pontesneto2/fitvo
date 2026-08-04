import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Testes do painel. Mesma toolchain ja usada em `packages/ui-web` (vitest +
 * jsdom) — nenhuma ferramenta nova entrou no repo por causa deste app.
 *
 * O alias `@` repete o `paths` do tsconfig: sem ele os modulos importados como
 * `@/lib/...` nao resolvem fora do build do Next.
 */
export default defineConfig({
  resolve: {
    alias: { '@': resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});

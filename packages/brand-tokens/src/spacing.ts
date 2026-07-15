/**
 * Escala de espacamento (design-system-components.md §0), base 4px. Numeros
 * unitless (px no web / dp no RN) — neutro entre plataformas. As chaves seguem a
 * escala do doc e nao sao contiguas (…6, depois 8, 10, 12, 16).
 */
export type SpaceStep = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const satisfies Record<SpaceStep, number>;

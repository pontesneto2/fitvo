/**
 * Movimento (design-system-components.md §0). Duracoes em ms; easing como tupla
 * de 4 pontos de controle (neutra entre plataformas): web via `easingToCss`, RN
 * via `Easing.bezier(...)` na camada mobile. Animacoes rapidas e funcionais;
 * `prefers-reduced-motion` / AccessibilityInfo e tratado na camada de UI.
 */
export type DurationName = 'instant' | 'fast' | 'normal' | 'slow';

export const duration = {
  instant: 100,
  fast: 150,
  normal: 250,
  slow: 400,
} as const satisfies Record<DurationName, number>;

export type EasingName = 'standard' | 'in' | 'out';

/** Tupla fixa de 4 — indices `[0..3]` sao seguros sob `noUncheckedIndexedAccess`. */
export type EasingTuple = readonly [number, number, number, number];

export const easing = {
  standard: [0.4, 0, 0.2, 1], // padrao geral
  in: [0.4, 0, 1, 1], // saida de elementos
  out: [0, 0, 0.2, 1], // entrada de elementos
} as const satisfies Record<EasingName, EasingTuple>;

/** cubic-bezier(...) para CSS/web. */
export function easingToCss(tuple: EasingTuple): string {
  return `cubic-bezier(${tuple[0]}, ${tuple[1]}, ${tuple[2]}, ${tuple[3]})`;
}

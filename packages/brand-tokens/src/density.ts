import type { SpaceStep } from './spacing';
import { space } from './spacing';
import type { DensityMode } from './types';

/**
 * Densidade (design-system.md §6, design-system-components.md §0): "mesmos tokens,
 * espacamento ajustado por contexto". Modelado como fator escalar sobre a escala
 * de espacamento — uma escala unica + um fator, sem duplicar escalas. `compact`
 * reduz ~25%. O mapa contexto -> modo (mobile e admin = compact, painel web =
 * comfortable) e decisao da camada de UI.
 */
export const densityScale = {
  compact: 0.75,
  comfortable: 1,
} as const satisfies Record<DensityMode, number>;

/** Espacamento efetivo de um step para um modo de densidade. */
export function scaleSpace(step: SpaceStep, mode: DensityMode): number {
  return space[step] * densityScale[mode];
}

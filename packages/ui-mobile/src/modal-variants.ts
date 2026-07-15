import type { ThemeMode } from '@fitvo/brand-tokens';
import { radius, scrim, semanticColors, space } from '@fitvo/brand-tokens';

/**
 * Dimensoes/cores do Modal MOBILE (design-system-components.md §12), SEM
 * react-native — testavel sob vitest.
 *
 * Painel: `surfaceRaised` (branco / `neutral-800`), raio `lg`, padding `space-6`,
 * largura maxima sm 400 / md 560 / lg 720. Overlay: token `scrim` (`neutral-900`
 * a 60%).
 *
 * Inferencia (RN): o blur de 4px do `scrim` (§12) e omitido no mobile — desfoque de
 * fundo em RN exige lib nativa extra (@react-native-community/blur), e a trava do
 * CLAUDE.md pede nao adicionar dependencia sem justificativa. Fica o veu
 * `neutral-900` a 60%, que ja isola o conteudo. Registrada.
 */
export type ModalSize = 'sm' | 'md' | 'lg';

export const MODAL_MAX_WIDTH: Record<ModalSize, number> = {
  sm: 400,
  md: 560,
  lg: 720,
};

export const MODAL_DIMS = {
  borderRadius: radius.lg, // 16 (§12)
  padding: space[6], // 24
} as const;

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Veu do overlay (§12): `neutral-900` a 60% (blur omitido no RN — ver nota).
 * `color` ja embute a opacidade como rgba, para nao aplicar `opacity` na View do
 * overlay (que desbotaria tambem o painel-filho).
 */
export const modalScrim = {
  color: hexToRgba(scrim.color, scrim.opacity),
} as const;

export interface ModalColors {
  readonly backgroundColor: string;
  readonly titleColor: string;
  readonly bodyColor: string;
}

export function resolveModalColors(mode: ThemeMode): ModalColors {
  return {
    backgroundColor: semanticColors.surfaceRaised[mode],
    titleColor: semanticColors.textPrincipal[mode],
    bodyColor: semanticColors.textAuxiliar[mode],
  };
}

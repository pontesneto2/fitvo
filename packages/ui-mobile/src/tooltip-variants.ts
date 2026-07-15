import type { ThemeMode } from '@fitvo/brand-tokens';
import { semanticColors } from '@fitvo/brand-tokens';

/**
 * Cores do Tooltip MOBILE (design-system-components.md §14), SEM react-native —
 * testavel sob vitest. Usa os tokens semanticos `tooltipSurface`/`tooltipText`, que
 * INVERTEM por tema (neutral-800/50 no light, neutral-100/900 no dark) — o tooltip
 * contrasta com a superficie em ambos.
 */
export interface TooltipColors {
  readonly backgroundColor: string;
  readonly textColor: string;
}

export function resolveTooltipColors(mode: ThemeMode): TooltipColors {
  return {
    backgroundColor: semanticColors.tooltipSurface[mode],
    textColor: semanticColors.tooltipText[mode],
  };
}

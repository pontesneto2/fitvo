import type { ThemeMode } from '@fitvo/brand-tokens';
import { colors } from '@fitvo/brand-tokens';

/**
 * Cores dos estados de tela MOBILE (design-system-components.md §15), SEM
 * react-native — testavel sob vitest.
 *
 * Skeleton: shimmer `neutral-100`->`neutral-200` (light); no dark sobe na rampa
 * (`neutral-800`->`neutral-700`, §21). Icone do vazio `neutral-300`; icone de erro
 * `danger-400` (ambos agnosticos de tema, como cor de ilustracao/perigo).
 */
export interface ShimmerColors {
  readonly from: string;
  readonly to: string;
}

export function resolveSkeletonColors(mode: ThemeMode): ShimmerColors {
  return mode === 'dark'
    ? { from: colors.neutral[800], to: colors.neutral[700] }
    : { from: colors.neutral[100], to: colors.neutral[200] };
}

/** Icone/ilustracao do estado vazio (§15). */
export const emptyIconColor = colors.neutral[300];

/** Icone do estado de erro (§15). */
export const errorIconColor = colors.danger[400];

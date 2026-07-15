import type { ThemeMode } from '@fitvo/brand-tokens';
import { colors, semanticColors } from '@fitvo/brand-tokens';

/**
 * Logica de cor do Menu lateral / Navegacao MOBILE (design-system-components.md
 * §10), SEM react-native — testavel sob vitest. Sem hover no touch: o "hover" do
 * §10 vira o `pressed`.
 *
 * Estados: normal (texto+icone `textAuxiliar`) / ativo (`brand-50` fundo,
 * `brand-700` texto, `brand-600` icone, barra 3px `brand-500`) / pressed
 * (`neutral-100`/`neutral-800`, `textPrincipal`) / disabled (`textSutil`).
 *
 * Inferencia dark (§10/§21 nao especificam): fundo do pressed sobe um stop
 * (`neutral-100`->`neutral-800`, §21); o ativo (marca) e agnostico de tema. A cor
 * da barra `brand-500` e agnostica.
 */
export interface NavItemColors {
  readonly backgroundColor: string;
  readonly textColor: string;
  readonly iconColor: string;
  /** Barra 3px a esquerda — so aparece no ativo (`brand-500`). */
  readonly barColor: string;
}

/** Largura da barra do item ativo (§10). */
export const NAV_BAR_WIDTH = 3;

export function resolveNavItemColors(
  mode: ThemeMode,
  active: boolean,
  disabled: boolean,
  pressed: boolean,
): NavItemColors {
  if (disabled) {
    const c = semanticColors.textSutil[mode];
    return { backgroundColor: 'transparent', textColor: c, iconColor: c, barColor: 'transparent' };
  }
  if (active) {
    return {
      backgroundColor: colors.brand[50],
      textColor: colors.brand[700],
      iconColor: colors.brand[600],
      barColor: colors.brand[500],
    };
  }
  if (pressed) {
    const c = semanticColors.textPrincipal[mode];
    return {
      backgroundColor: mode === 'dark' ? colors.neutral[800] : colors.neutral[100],
      textColor: c,
      iconColor: c,
      barColor: 'transparent',
    };
  }
  const c = semanticColors.textAuxiliar[mode];
  return { backgroundColor: 'transparent', textColor: c, iconColor: c, barColor: 'transparent' };
}

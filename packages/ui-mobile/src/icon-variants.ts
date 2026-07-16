import type { ThemeMode } from '@fitvo/brand-tokens';
import { colors, iconSize, resolveTheme } from '@fitvo/brand-tokens';

/**
 * Logica do Icon MOBILE (design-system-components.md §19), SEM react-native —
 * testavel sob vitest. `default` resolve o texto auxiliar do tema ATIVO (sem
 * inversao manual, via `resolveTheme`); `active` e o stop fixo `brand-600`. Uma
 * string literal passa direto (cor pontual fora do fluxo de token).
 */
export type IconSizeName = 'sm' | 'md' | 'lg';
export type IconColorName = 'default' | 'active';

export function iconDiameter(size: IconSizeName): number {
  return iconSize[size];
}

export function resolveIconColor(
  color: IconColorName | string | undefined,
  mode: ThemeMode,
): string {
  if (color === undefined || color === 'default') return resolveTheme(mode).textAuxiliar;
  if (color === 'active') return colors.brand[600];
  return color;
}

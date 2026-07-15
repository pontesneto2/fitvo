import type { ThemeMode } from '@fitvo/brand-tokens';
import { colors, semanticColors } from '@fitvo/brand-tokens';

/**
 * Logica de cor do Breadcrumb MOBILE (design-system-components.md §11), SEM
 * react-native — testavel sob vitest.
 *
 * Item normal `textAuxiliar`; atual `textPrincipal` (peso 500); separador `/`
 * `textSutil`; hover -> no touch vira `pressed` = `brand-600` (agnostico de tema).
 * Textos semanticos adaptam light/dark automaticamente.
 */
export function resolveCrumbColor(mode: ThemeMode, current: boolean, pressed: boolean): string {
  if (current) return semanticColors.textPrincipal[mode];
  if (pressed) return colors.brand[600];
  return semanticColors.textAuxiliar[mode];
}

/** Cor do separador `/` (§11). */
export function crumbSeparatorColor(mode: ThemeMode): string {
  return semanticColors.textSutil[mode];
}

import type { ResolvedTheme, ThemeMode } from '@fitvo/brand-tokens';
import { resolveTheme } from '@fitvo/brand-tokens';

/**
 * Temas resolvidos para MOBILE (design-system.md §8). No RN nao ha cascata CSS: o
 * tema e resolvido em runtime, entao pre-achatamos os pares {light,dark} dos tokens
 * semanticos em dois mapas planos `nome -> hex`. `resolveTheme` (brand-tokens) e a
 * fonte unica do mapeamento — aqui so materializamos os dois modos.
 */
export const themes = {
  light: resolveTheme('light'),
  dark: resolveTheme('dark'),
} as const satisfies Record<ThemeMode, ResolvedTheme>;

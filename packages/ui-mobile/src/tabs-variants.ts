import type { ColorRamp, ThemeMode } from '@fitvo/brand-tokens';
import { colors, semanticColors } from '@fitvo/brand-tokens';

/**
 * Logica de cor do Tabs MOBILE (design-system-components.md §9), SEM react-native —
 * testavel sob vitest. Estados: normal (`textAuxiliar`) / ativo (acento) / pressed
 * (equivalente touch do hover: `textPrincipal` + fundo neutro) / disabled
 * (`textSutil`).
 *
 * Acento por ambiente (§9 + design-system.md §7): `brand` (padrao) ou os ambientes
 * treino=lime / nutricao=amber / medicina=clinic. O indicador usa `acento-500`.
 *
 * Inferencia dark (§9/§21 nao especificam): fundo transparente do ativo tornaria o
 * texto `acento-700` ilegivel no escuro -> clareia para `acento-400` (espelha o uso
 * de brand-400 no dark, §21); o fundo do pressed sobe um stop (`neutral-50`->
 * `neutral-800`). Indicador `acento-500` fixo nos dois temas.
 */
export type TabsAccent = 'brand' | 'training' | 'nutrition' | 'medicine';

const ACCENT_RAMP: Record<TabsAccent, ColorRamp> = {
  brand: colors.brand,
  training: colors.lime,
  nutrition: colors.amber,
  medicine: colors.clinic,
};

/** Cor do indicador (barra 2px) por acento — `acento-500`, agnostica de tema. */
export function tabIndicatorColor(accent: TabsAccent): string {
  return ACCENT_RAMP[accent][500];
}

export interface TabColors {
  readonly textColor: string;
  readonly backgroundColor: string;
}

export function resolveTabColors(
  mode: ThemeMode,
  accent: TabsAccent,
  active: boolean,
  disabled: boolean,
  pressed: boolean,
): TabColors {
  const dark = mode === 'dark';
  if (disabled) {
    return { textColor: semanticColors.textSutil[mode], backgroundColor: 'transparent' };
  }
  if (active) {
    const ramp = ACCENT_RAMP[accent];
    return { textColor: dark ? ramp[400] : ramp[700], backgroundColor: 'transparent' };
  }
  if (pressed) {
    return {
      textColor: semanticColors.textPrincipal[mode],
      backgroundColor: dark ? colors.neutral[800] : colors.neutral[50],
    };
  }
  return { textColor: semanticColors.textAuxiliar[mode], backgroundColor: 'transparent' };
}

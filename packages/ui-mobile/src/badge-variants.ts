import type { ThemeMode } from '@fitvo/brand-tokens';
import { colors, radius, semanticColors, space } from '@fitvo/brand-tokens';

/**
 * Logica de cor/dimensao do Badge MOBILE (design-system-components.md §8), SEM
 * react-native — testavel sob vitest. Chip de status/rotulo: altura 24, raio
 * `full`, padding `space-2`, fonte Inter 12/500 (na camada RN).
 *
 * Dark: §8/§21 nao especificam. Convencao registrada (ver Card/Checkbox): os tons
 * de ACENTO (brand/energy/warning/danger/clinic/lime/amber) sao agnosticos de tema;
 * apenas o `neutral` adapta pela regra §21 "sobe na rampa" (neutral-100->700; texto
 * pelo token semantico `textAuxiliar`). O `removePressColor` (tom-200 da rampa) e o
 * equivalente touch do hover do `×` no web (§8) — no touch nao ha hover.
 */
export type BadgeVariant =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'training'
  | 'nutrition'
  | 'medicine';

export const BADGE_DIMS = {
  height: 24, // §8
  borderRadius: radius.full,
  paddingHorizontal: space[2], // 8 (§8)
} as const;

export interface BadgeColors {
  readonly backgroundColor: string;
  readonly textColor: string;
  /** Fundo do botao `×` quando pressionado (tom-200 da rampa; §8). */
  readonly removePressColor: string;
}

export function resolveBadgeColors(mode: ThemeMode, variant: BadgeVariant): BadgeColors {
  const dark = mode === 'dark';
  switch (variant) {
    case 'neutral':
      return {
        backgroundColor: dark ? colors.neutral[700] : colors.neutral[100],
        textColor: dark ? semanticColors.textAuxiliar.dark : semanticColors.textAuxiliar.light,
        removePressColor: dark ? colors.neutral[600] : colors.neutral[200],
      };
    case 'brand':
      return {
        backgroundColor: colors.brand[50],
        textColor: colors.brand[700],
        removePressColor: colors.brand[200],
      };
    case 'success':
      return {
        backgroundColor: colors.energy[50],
        textColor: colors.energy[800],
        removePressColor: colors.energy[200],
      };
    case 'warning':
      return {
        backgroundColor: colors.warning[50],
        textColor: colors.warning[800],
        removePressColor: colors.warning[200],
      };
    case 'error':
      return {
        backgroundColor: colors.danger[50],
        textColor: colors.danger[700],
        removePressColor: colors.danger[200],
      };
    case 'info':
      return {
        backgroundColor: colors.clinic[50],
        textColor: colors.clinic[700],
        removePressColor: colors.clinic[200],
      };
    case 'training':
      return {
        backgroundColor: colors.lime[50],
        textColor: colors.lime[800],
        removePressColor: colors.lime[200],
      };
    case 'nutrition':
      return {
        backgroundColor: colors.amber[50],
        textColor: colors.amber[800],
        removePressColor: colors.amber[200],
      };
    case 'medicine':
      return {
        backgroundColor: colors.clinic[50],
        textColor: colors.clinic[800],
        removePressColor: colors.clinic[200],
      };
  }
}

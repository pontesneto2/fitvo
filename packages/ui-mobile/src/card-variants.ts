import type { ThemeMode } from '@fitvo/brand-tokens';
import { colors, radius, space, white } from '@fitvo/brand-tokens';

/**
 * Logica de cor/dimensao/elevacao do Card MOBILE (design-system-components.md §7 +
 * dark §21), SEM react-native — testavel sob vitest. Elevacao e SEMANTICA
 * (design-system.md §6): flat por padrao, sombra so em `attention`.
 *
 * No touch nao ha hover: o estado "hover" do §7 (subtle + sobe 2px) nao existe; o
 * "ativo" do doc vira o `pressed`. Superficies do card espelham `surfaceRaised`
 * (branco / `neutral-800`) e a base `surfaceBase` (`neutral-50` / `neutral-900`)
 * para o pressed; marca (attention/selected) e agnostica de tema.
 */
export type CardVariant = 'default' | 'interactive' | 'attention' | 'selected';
export type CardDensity = 'compact' | 'comfortable';
export type CardElevation = 'flat' | 'subtle' | 'raised';

export const CARD_DIMS = {
  borderRadius: radius.lg, // 16 (§7)
  paddingCompact: space[4], // 16 — padrao mobile (§0)
  paddingComfortable: space[6], // 24
} as const;

export interface CardColors {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly borderWidth: number;
  readonly elevation: CardElevation;
}

export function resolveCardColors(
  mode: ThemeMode,
  variant: CardVariant,
  pressed: boolean,
): CardColors {
  const dark = mode === 'dark';
  const cardSurface = dark ? colors.neutral[800] : white; // surfaceRaised
  const baseSurface = dark ? colors.neutral[900] : colors.neutral[50]; // surfaceBase (ativo)
  const lineDefault = dark ? colors.neutral[700] : colors.neutral[200];
  const lineHover = dark ? colors.neutral[600] : colors.neutral[300];

  switch (variant) {
    case 'attention':
      return {
        backgroundColor: cardSurface,
        borderColor: colors.brand[300],
        borderWidth: 1,
        elevation: 'raised',
      };
    case 'selected':
      return {
        backgroundColor: colors.brand[50],
        borderColor: colors.brand[500],
        borderWidth: 1.5,
        elevation: 'subtle',
      };
    case 'interactive':
      return pressed
        ? {
            backgroundColor: baseSurface,
            borderColor: lineHover,
            borderWidth: 1,
            elevation: 'flat',
          }
        : {
            backgroundColor: cardSurface,
            borderColor: lineDefault,
            borderWidth: 1,
            elevation: 'flat',
          };
    case 'default':
    default:
      return {
        backgroundColor: cardSurface,
        borderColor: lineDefault,
        borderWidth: 1,
        elevation: 'flat',
      };
  }
}

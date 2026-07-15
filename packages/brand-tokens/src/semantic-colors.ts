import { colors, white } from './colors';
import type { ThemedColor } from './types';

/**
 * Tokens semanticos de cor com par light/dark (design-system.md §4, §6, §8;
 * design-system-components.md §21). O dark e resolvido por token (theme.ts),
 * nunca por inversao manual no componente. Referenciam stops primitivos em vez de
 * duplicar hex: se a rampa mudar, o semantico acompanha automaticamente.
 *
 * No dark as superficies SOBEM na rampa neutra (base 900 -> card 800 -> elevado
 * 700) em vez de descerem; as bordas acompanham. Cobrimos aqui os papeis
 * reutilizaveis (texto, superficie, borda, tooltip, foco). Estados finos de um
 * componente especifico (ex.: tabela de estados do input) sao compostos na camada
 * de UI a partir destes tokens + stops de rampa (ver §21).
 */
export const semanticColors = {
  // Texto (§4)
  textPrincipal: { light: colors.neutral[900], dark: colors.neutral[50] },
  textAuxiliar: { light: colors.neutral[600], dark: colors.neutral[300] },
  textSutil: { light: colors.neutral[400], dark: colors.neutral[500] },

  // Superficies (§21) — no dark sobem na rampa neutra
  surfaceBase: { light: colors.neutral[50], dark: colors.neutral[900] },
  surfaceRaised: { light: white, dark: colors.neutral[800] },
  surfaceOverlay: { light: white, dark: colors.neutral[700] },

  // Bordas (§21) — hover sobe um stop; foco usa a marca
  borderDefault: { light: colors.neutral[200], dark: colors.neutral[700] },
  borderHover: { light: colors.neutral[300], dark: colors.neutral[600] },
  borderFocus: { light: colors.brand[500], dark: colors.brand[400] },

  // Tooltip (§14) — inverte
  tooltipSurface: { light: colors.neutral[800], dark: colors.neutral[100] },
  tooltipText: { light: colors.neutral[50], dark: colors.neutral[900] },

  // Anel de foco (§0) — mais claro no dark
  focusRing: { light: colors.brand[300], dark: colors.brand[400] },
} as const satisfies Record<string, ThemedColor>;

/** Nomes dos tokens semanticos (derivado da fonte). */
export type SemanticColorName = keyof typeof semanticColors;

/**
 * Nomes das CSS custom properties — fonte UNICA da convencao. toCssVariables()
 * (emite :root/.dark) e cssVarRef() (mapeia no Tailwind) leem daqui, entao os dois
 * lados nunca divergem. O `satisfies Record<SemanticColorName, string>` garante,
 * em tempo de compilacao, que TODO token semantico tem uma CSS var (adicionar um
 * token e esquecer a var vira erro de tipo).
 */
export const cssVarNames = {
  textPrincipal: '--text-principal',
  textAuxiliar: '--text-auxiliar',
  textSutil: '--text-sutil',
  surfaceBase: '--surface-base',
  surfaceRaised: '--surface-raised',
  surfaceOverlay: '--surface-overlay',
  borderDefault: '--border-default',
  borderHover: '--border-hover',
  borderFocus: '--border-focus',
  tooltipSurface: '--tooltip-surface',
  tooltipText: '--tooltip-text',
  focusRing: '--focus-ring',
} as const satisfies Record<SemanticColorName, string>;

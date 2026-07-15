import { colors, fontSize, logoMarkSize } from '@fitvo/brand-tokens';

/**
 * Logica do Logo MOBILE (design-system.md §9 / design-system-components.md
 * §20 — simbolo final ainda [A DEFINIR]), SEM react-native — testavel sob
 * vitest. Wordmark: "FIT" `brand-500` / "VO" `energy-400`. Mark PROVISORIO:
 * dois blocos geometricos, sem simbolo de marca.
 */
export type LogoSizeName = 'sm' | 'md' | 'lg';

export const WORDMARK_COLORS = {
  fit: colors.brand[500],
  vo: colors.energy[400],
} as const;

const wordmarkFontSizeBySize = {
  sm: fontSize.h3,
  md: fontSize.h2,
  lg: fontSize.h1,
} as const satisfies Record<LogoSizeName, number>;

export function wordmarkFontSize(size: LogoSizeName): number {
  return wordmarkFontSizeBySize[size];
}

export function markDiameter(size: LogoSizeName): number {
  return logoMarkSize[size];
}

/** Tamanho do bloco secundario do mark provisorio (~50% do bloco principal). */
export function markAccentSize(size: LogoSizeName): number {
  return Math.round(logoMarkSize[size] * 0.5);
}

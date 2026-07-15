/**
 * Tipografia (design-system.md §5). Titulos em Poppins, corpo em Inter. Ambas
 * gratuitas (Google Fonts) e embarcadas no mobile via expo-font (o mapa
 * (familia,peso) -> nome expo e cola do ui-mobile). Sentence case em toda a UI.
 *
 * Pesos por fonte (§5, decidido): Poppins 500 e 600; Inter 400, 500 e 600 — o
 * Inter e a fonte de trabalho (400 corpo, 500 labels/botoes, 600 cabecalho de
 * tabela). `fontSize.footnote` (13px) atende a descricao de toast (§13).
 */
export const fontFamily = {
  heading: 'Poppins',
  body: 'Inter',
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
} as const;

/** Escala de tamanhos (px), superset dos dois docs. */
export const fontSize = {
  caption: 12, // §5 caption/meta
  footnote: 13, // components §13 (descricao de toast) — superset
  small: 14, // §5 body pequeno
  body: 16, // §5 body
  h3: 18, // §5 H3
  h2: 24, // §5 H2 (22–24)
  h1: 28, // §5 H1 (28–32)
  display: 32, // §5 display (28–32)
} as const satisfies Record<string, number>;

/**
 * Alturas de linha (razao unitless). Body 1.6 e fixo no §5; as demais sao
 * proporcao base. RN precisa de lineHeight absoluto -> multiplicar por fontSize
 * na camada mobile.
 */
export const lineHeight = {
  tight: 1.2,
  snug: 1.4,
  normal: 1.5,
  relaxed: 1.6,
} as const;

export type TextStyleName = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption';

export interface TextStyle {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: number;
  /** Razao unitless (ver nota em `lineHeight`). */
  readonly lineHeight: number;
}

/** Estilos de texto por papel (design-system.md §5). */
export const textStyles = {
  display: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.display,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
  },
  h1: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.h1,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
  },
  h2: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.h2,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
  },
  h3: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.h3,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.snug,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.relaxed,
  },
  bodySmall: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.snug,
  },
} as const satisfies Record<TextStyleName, TextStyle>;

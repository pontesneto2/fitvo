import { black, colors } from './colors';

/**
 * Elevacao (design-system.md §6): elevacao e SEMANTICA — quanto mais alto o
 * elemento "flutua", mais importante/urgente. Dia a dia quase flat, apoiado em
 * bordas finas; sombra perceptivel so no que PEDE atencao. Os parametros
 * estruturados sao a fonte unica (nao ha string web + objeto native duplicados).
 *
 * Quatro niveis (valores definitivos, design-system-components.md §0): `flat`
 * (sem sombra), `subtle`, `raised`, `overlay`.
 *
 * DARK MODE (design-system.md §6): sombra funciona mal sobre fundo escuro. No dark
 * a elevacao se expressa por SUPERFICIE mais clara (ver `semanticColors`:
 * surfaceBase/Raised/Overlay), e a sombra fica em METADE da opacidade so como
 * reforco sutil — o que os tokens `.dark` abaixo ja codificam.
 */
export interface ShadowParams {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blur: number; // blur no web / shadowRadius no iOS
  readonly spread: number; // web apenas
  readonly color: string;
  readonly opacity: number; // 0..1
  readonly elevation: number; // dp no Android (nao derivavel do blur)
}

export type ThemedShadow = {
  readonly light: ShadowParams;
  readonly dark: ShadowParams;
};

export type ElevationLevel = 'flat' | 'subtle' | 'raised' | 'overlay';

const NONE: ShadowParams = {
  offsetX: 0,
  offsetY: 0,
  blur: 0,
  spread: 0,
  color: black,
  opacity: 0,
  elevation: 0,
};

export const shadows = {
  flat: { light: NONE, dark: NONE },
  subtle: {
    light: {
      offsetX: 0,
      offsetY: 1,
      blur: 2,
      spread: 0,
      color: black,
      opacity: 0.04,
      elevation: 1,
    },
    dark: { offsetX: 0, offsetY: 1, blur: 2, spread: 0, color: black, opacity: 0.02, elevation: 1 },
  },
  raised: {
    light: {
      offsetX: 0,
      offsetY: 4,
      blur: 12,
      spread: 0,
      color: black,
      opacity: 0.08,
      elevation: 3,
    },
    dark: {
      offsetX: 0,
      offsetY: 4,
      blur: 12,
      spread: 0,
      color: black,
      opacity: 0.04,
      elevation: 3,
    },
  },
  overlay: {
    light: {
      offsetX: 0,
      offsetY: 12,
      blur: 32,
      spread: 0,
      color: black,
      opacity: 0.16,
      elevation: 8,
    },
    dark: {
      offsetX: 0,
      offsetY: 12,
      blur: 32,
      spread: 0,
      color: black,
      opacity: 0.08,
      elevation: 8,
    },
  },
} as const satisfies Record<ElevationLevel, ThemedShadow>;

/**
 * Scrim do overlay de modal (design-system-components.md §12): `neutral-900` a 60%
 * + blur 4px. (Distinto do nivel de elevacao `overlay`.)
 */
export const scrim = {
  color: colors.neutral[900],
  opacity: 0.6,
  blur: 4,
} as const;

export interface NativeShadow {
  readonly shadowColor: string;
  readonly shadowOffset: { readonly width: number; readonly height: number };
  readonly shadowOpacity: number;
  readonly shadowRadius: number;
  readonly elevation: number;
}

function hexToRgb(hex: string): { readonly r: number; readonly g: number; readonly b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** box-shadow CSS (web). `none` quando o nivel nao tem sombra (ex.: `flat`). */
export function shadowToCss(params: ShadowParams): string {
  if (params.opacity === 0) {
    return 'none';
  }
  const { r, g, b } = hexToRgb(params.color);
  return `${params.offsetX}px ${params.offsetY}px ${params.blur}px ${params.spread}px rgba(${r}, ${g}, ${b}, ${params.opacity})`;
}

/** Props de sombra do React Native. */
export function shadowToNative(params: ShadowParams): NativeShadow {
  return {
    shadowColor: params.color,
    shadowOffset: { width: params.offsetX, height: params.offsetY },
    shadowOpacity: params.opacity,
    shadowRadius: params.blur,
    elevation: params.elevation,
  };
}

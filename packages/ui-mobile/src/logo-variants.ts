import { colors } from '@fitvo/brand-tokens';

/**
 * Constantes do Logo MOBILE (design-system.md §9 + components §20), SEM
 * react-native — testavel sob vitest.
 *
 * O wordmark e arte de marca (raster PNG no mobile — o app passa a `source` via
 * `require` das artes em packages/brand-tokens/assets/logo/, ja que resolucao de
 * asset em RN pertence ao bundler do app). Proporcao intrinseca da arte
 * (viewBox 1944 x 1184.25 do SVG oficial) exposta aqui p/ dimensionar por altura.
 *
 * Icone: PROVISORIO (§20) — "V" `brand-500` com detalhe `energy-400`, desenhado
 * (sem SVG/lucide no mobile; §19 segue com o agente principal). Trocar pelo
 * definitivo nao deve exigir tocar no componente.
 */
export const LOGO_WORDMARK_ASPECT = 1944 / 1184.25; // ~1.642 (largura / altura)

export const LOGO_ICON_COLORS = {
  /** Traco principal do simbolo. */
  stroke: colors.brand[500],
  /** Detalhe/energia (neon do "VO"). */
  accent: colors.energy[400],
} as const;

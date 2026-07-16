/**
 * Constantes do Logo MOBILE (design-system.md §9 + components §20), SEM
 * react-native — testavel sob vitest.
 *
 * O wordmark e arte de marca (raster PNG no mobile — o app passa a `source` via
 * `require` das artes em packages/brand-tokens/assets/logo/, ja que resolucao de
 * asset em RN pertence ao bundler do app). Proporcao intrinseca da arte
 * (viewBox 1944 x 1184.25 do SVG oficial) exposta aqui p/ dimensionar por altura.
 *
 * Icone PROVISORIO: `LOGO_ICON_PROVISIONAL` em `logo-art.ts` (SVG real via
 * `SvgXml`, §19) — cores ja bakeadas na arte, sem token separado aqui.
 */
export const LOGO_WORDMARK_ASPECT = 1944 / 1184.25; // ~1.642 (largura / altura)

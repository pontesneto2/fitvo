/**
 * @fitvo/brand-tokens — tokens de marca compartilhados (rampas de cor, niveis de
 * texto, tipografia, espacamento, raio, elevacao, movimento, foco, icones,
 * densidade, acento por ambiente). Fonte da verdade: docs/design-system.md e
 * docs/design-system-components.md.
 *
 * Framework-neutro: consumido como TS cru por ui-web (Tailwind/React) e ui-mobile
 * (React Native). A cola de framework (preset Tailwind, ThemeProvider RN, injecao
 * de CSS) mora nesses pacotes (design-system.md §8). Todo token de cor semantico
 * tem par light/dark; o dark e resolvido por token (theme.ts), nunca por inversao
 * manual no componente.
 */
export * from './charts';
export * from './colors';
export * from './density';
export * from './elevation';
export * from './environments';
export * from './focus';
export * from './icons';
export * from './motion';
export * from './radius';
export * from './semantic-colors';
export * from './sizing';
export * from './spacing';
export * from './theme';
export * from './types';
export * from './typography';

/**
 * Tamanhos de controle e avatar (design-system-components.md §1, §2, §18).
 * Numeros unitless (px no web / dp no RN).
 */
export type ControlSize = 'sm' | 'md' | 'lg';

/** Altura de botoes e inputs (§1, §2). */
export const controlHeight = {
  sm: 32,
  md: 40,
  lg: 48,
} as const satisfies Record<ControlSize, number>;

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Diametro de avatar (§18). */
export const avatarSize = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
} as const satisfies Record<AvatarSize, number>;

export type LogoSize = 'sm' | 'md' | 'lg';

/**
 * Dimensoes do Logo (mark + wordmark, §9/§20 — "Logo" ainda [A DEFINIR]). O mark
 * e PROVISORIO (forma geometrica, sem simbolo final); o tamanho do texto do
 * wordmark usa `fontSize.h3/h2/h1` diretamente no componente, nao aqui.
 */
export const logoMarkSize = {
  sm: 20,
  md: 28,
  lg: 36,
} as const satisfies Record<LogoSize, number>;

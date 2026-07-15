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

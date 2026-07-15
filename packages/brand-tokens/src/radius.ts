/**
 * Raios (design-system.md §6). Cada elemento usa seu raio proporcional — nao um
 * raio unico para tudo. Numeros unitless (px no web / dp no RN).
 */
export type RadiusName = 'sm' | 'md' | 'lg' | 'full';

export const radius = {
  sm: 8, // inputs, botoes pequenos
  md: 12, // botoes, campos
  lg: 16, // cards
  full: 999, // pills, tags, avatares
} as const satisfies Record<RadiusName, number>;

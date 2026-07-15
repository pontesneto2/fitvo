import { avatarSize, colors } from '@fitvo/brand-tokens';

/**
 * Logica do Avatar MOBILE (design-system-components.md §18), SEM react-native —
 * testavel sob vitest. Diametros do token `avatarSize`; fallback de iniciais em
 * `brand-100` com texto `brand-700` (agnostico de tema, como a marca). Tamanho da
 * fonte proporcional ao diametro (derivado do token, nao chumbado).
 */
export type AvatarSizeName = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const AVATAR_FALLBACK = {
  backgroundColor: colors.brand[100],
  textColor: colors.brand[700],
} as const;

export function avatarDiameter(size: AvatarSizeName): number {
  return avatarSize[size];
}

/** Tamanho da fonte das iniciais (~40% do diametro). */
export function avatarFontSize(size: AvatarSizeName): number {
  return Math.round(avatarSize[size] * 0.4);
}

/** Iniciais: 1a letra da primeira e da ultima palavra (ate 2), em maiuscula. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase();
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return (first + last).toUpperCase();
}

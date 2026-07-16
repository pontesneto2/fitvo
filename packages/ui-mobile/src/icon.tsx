import { iconStroke } from '@fitvo/brand-tokens';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';

import type { IconColorName, IconSizeName } from './icon-variants';
import { iconDiameter, resolveIconColor } from './icon-variants';
import { useTheme } from './theme-context';

/**
 * Icone MOBILE (design-system-components.md §19). Wrapper fino sobre a familia
 * adotada (Lucide, `iconFamily` token): recebe o componente do icone (import
 * nomeado de `lucide-react-native` — preserva tree-shaking) e aplica os tokens
 * de tamanho/traco/cor. Sem `currentColor` em RN — por isso `color` sempre
 * resolve para um valor concreto (padrao `default` = texto auxiliar do tema
 * ATIVO, via `useTheme()`, nunca invertido a mao). Logica pura em
 * `icon-variants.ts` (testavel sem RN).
 */
export type { IconColorName, IconSizeName };

export interface IconProps {
  readonly icon: LucideIcon;
  readonly size?: IconSizeName;
  /** 'default' | 'active' (tokens) ou uma cor literal. Padrao 'default'. */
  readonly color?: IconColorName | string;
}

export function Icon({ icon: IconComponent, size = 'md', color }: IconProps): ReactNode {
  const theme = useTheme();
  return (
    <IconComponent
      size={iconDiameter(size)}
      strokeWidth={iconStroke}
      color={resolveIconColor(color, theme.mode)}
    />
  );
}

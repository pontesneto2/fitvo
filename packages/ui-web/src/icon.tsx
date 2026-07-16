import { iconSize, iconStroke } from '@fitvo/brand-tokens';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from './cn';

/**
 * Icone WEB (design-system-components.md §19). Wrapper fino sobre a familia
 * adotada (Lucide, `iconFamily` token): recebe o componente do icone (import
 * nomeado de `lucide-react` — preserva tree-shaking, so entra no bundle o
 * icone realmente usado) e aplica os tokens de tamanho/traco/cor.
 *
 * `color` e opcional: omitido, o icone herda `currentColor` do elemento pai
 * (padrao do Lucide) — e como Badge/Toast/Table ja coloriam seus icones por
 * contexto antes desta troca. So passar quando o icone precisa de uma cor
 * PROPRIA fora do fluxo herdado.
 */
export type IconSizeName = 'sm' | 'md' | 'lg';
export type IconColorName = 'default' | 'active';

export interface IconProps {
  readonly icon: LucideIcon;
  readonly size?: IconSizeName;
  /** 'default' = fg-muted (texto auxiliar); 'active' = brand-600. */
  readonly color?: IconColorName;
  readonly className?: string;
  readonly 'aria-label'?: string;
}

const colorClass = {
  default: 'text-fg-muted',
  active: 'text-brand-600',
} as const satisfies Record<IconColorName, string>;

export function Icon({
  icon: IconComponent,
  size = 'md',
  color,
  className,
  'aria-label': ariaLabel,
}: IconProps): ReactNode {
  return (
    <IconComponent
      size={iconSize[size]}
      strokeWidth={iconStroke}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      className={cn(color ? colorClass[color] : undefined, className)}
    />
  );
}

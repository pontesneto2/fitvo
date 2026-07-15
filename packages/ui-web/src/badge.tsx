import { X } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from './cn';
import { Icon } from './icon';

/**
 * Badge / Tag WEB (design-system-components.md §8). Chip de status/rotulo.
 * Altura 24px (`h-6`), raio `full`, padding `space-2` (`px-2`), fonte Inter 12/500
 * (`text-caption font-medium`).
 *
 * 9 variantes (§8): `neutral`, `brand`, `success` (energy), `warning`, `error`
 * (danger), `info` (clinic-700), `training` (lime), `nutrition` (amber),
 * `medicine` (clinic-800). Cada uma = fundo tom-50 + texto tom-700/800 da rampa.
 *
 * Removivel (§8): `removable` + `onRemove` adicionam um botao `×` que, no hover,
 * ganha fundo no tom-200 da MESMA rampa. O botao tem `aria-label` e foco visivel.
 *
 * Dark: §8/§21 nao especificam o Badge. Convencao registrada (ver Card/Checkbox):
 * os tons de ACENTO (brand/energy/warning/danger/clinic/lime/amber) sao agnosticos
 * de tema — chips tingidos intencionais, como o `selected` do Card. Apenas o
 * `neutral` adapta pela regra §21 "sobe na rampa" (`neutral-100`->`neutral-700`,
 * hover do × `neutral-200`->`neutral-600`), pois um chip neutro claro sobre fundo
 * escuro leria como quebrado; o texto neutro usa o token semantico `fg-muted`.
 */
export type BadgeVariant =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'training'
  | 'nutrition'
  | 'medicine';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'onError'> {
  readonly variant?: BadgeVariant;
  /** Adiciona o botao `×` de remocao. Requer `onRemove` para agir. */
  readonly removable?: boolean;
  readonly onRemove?: () => void;
  /** Rotulo acessivel do botao de remocao (padrao: "Remover"). */
  readonly removeLabel?: string;
}

const base = cn(
  'inline-flex h-6 items-center gap-1 rounded-full px-2 font-body text-caption font-medium',
);

/** Fundo + texto por variante (tons de acento agnosticos; neutral adapta no dark). */
const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-neutral-100 text-fg-muted dark:bg-neutral-700',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-energy-50 text-energy-800',
  warning: 'bg-warning-50 text-warning-800',
  error: 'bg-danger-50 text-danger-700',
  info: 'bg-clinic-50 text-clinic-700',
  training: 'bg-lime-50 text-lime-800',
  nutrition: 'bg-amber-50 text-amber-800',
  medicine: 'bg-clinic-50 text-clinic-800',
};

/** Hover do botao `×`: tom-200 da mesma rampa (§8); neutral adapta no dark. */
const removeHoverClasses: Record<BadgeVariant, string> = {
  neutral: 'hover:bg-neutral-200 dark:hover:bg-neutral-600',
  brand: 'hover:bg-brand-200',
  success: 'hover:bg-energy-200',
  warning: 'hover:bg-warning-200',
  error: 'hover:bg-danger-200',
  info: 'hover:bg-clinic-200',
  training: 'hover:bg-lime-200',
  nutrition: 'hover:bg-amber-200',
  medicine: 'hover:bg-clinic-200',
};

export function Badge({
  variant = 'neutral',
  removable = false,
  onRemove,
  removeLabel = 'Remover',
  className,
  children,
  ...rest
}: BadgeProps): ReactNode {
  return (
    <span className={cn(base, variantClasses[variant], className)} {...rest}>
      {children}
      {removable ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className={cn(
            '-mr-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-current',
            'transition-colors duration-fast ease-standard',
            'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-1 focus-visible:ring-focus',
            removeHoverClasses[variant],
          )}
        >
          <Icon icon={X} size="sm" />
        </button>
      ) : null}
    </span>
  );
}

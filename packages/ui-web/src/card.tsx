import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';

import { cn } from './cn';

/**
 * Card WEB (design-system-components.md §7 + dark §21). Container de superficie.
 * Raio `lg` (16px); padding por densidade (`space-4` compact / `space-6`
 * comfortable, §0). Elevacao e SEMANTICA (design-system.md §6): card comum e quase
 * flat; sombra so quando pede atencao.
 *
 * Variantes (§7):
 * - `default`: superficie `raised` (§21 card = branco/`neutral-800` = `surfaceRaised`),
 *   borda `line`, sem sombra (`flat`).
 * - `interactive`: adiciona hover (borda `line-hover` + `subtle` + sobe 2px), ativo
 *   (fundo base + `flat`) e foco (borda `line-focus` + anel). Focavel; com `onClick`
 *   vira `role=button` e ativa por Enter/Espaco (a11y baseline do CLAUDE.md).
 * - `attention`: borda `brand-300` + elevacao `raised` (o unico que "pede atencao").
 * - `selected`: fundo `brand-50`, borda 1.5px `brand-500`, sombra `subtle`.
 *
 * Dark: superficies/bordas vem dos tokens semanticos (corretos nos dois temas);
 * marca (attention/selected) e agnostica. O "ativo" no dark usa a superficie base
 * (`neutral-900`), espelhando o `neutral-50` do light (regra §21).
 */
export type CardVariant = 'default' | 'interactive' | 'attention' | 'selected';
export type CardDensity = 'compact' | 'comfortable';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly variant?: CardVariant;
  /** Padding: `compact` = space-4; `comfortable` (padrao web) = space-6. */
  readonly density?: CardDensity;
}

const base = cn(
  'rounded-lg',
  'transition-[background-color,border-color,box-shadow,transform] duration-fast ease-standard',
);

const densityClasses: Record<CardDensity, string> = {
  compact: 'p-4',
  comfortable: 'p-6',
};

const variantClasses: Record<CardVariant, string> = {
  default: 'border border-line bg-surface-raised shadow-flat',
  interactive: cn(
    'cursor-pointer border border-line bg-surface-raised shadow-flat',
    'hover:border-line-hover hover:shadow-subtle hover:-translate-y-0.5',
    'active:translate-y-0 active:border-line-hover active:bg-neutral-50 active:shadow-flat dark:active:bg-neutral-900',
    'focus-visible:border-line-focus focus-visible:shadow-subtle focus-visible:outline-none',
    'focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:ring-focus',
    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
  ),
  attention: 'border border-brand-300 bg-surface-raised shadow-raised',
  selected: 'border-[1.5px] border-brand-500 bg-brand-50 shadow-subtle',
};

export function Card({
  variant = 'default',
  density = 'comfortable',
  className,
  children,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  ...rest
}: CardProps): ReactNode {
  const interactive = variant === 'interactive';

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (interactive && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.currentTarget.click();
    }
    onKeyDown?.(e);
  };

  return (
    <div
      className={cn(base, densityClasses[density], variantClasses[variant], className)}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : onKeyDown}
      role={role ?? (interactive && onClick ? 'button' : undefined)}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      {...rest}
    >
      {children}
    </div>
  );
}

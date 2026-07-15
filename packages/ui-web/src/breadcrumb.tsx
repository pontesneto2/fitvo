import type { ReactNode } from 'react';

import { cn } from './cn';

/**
 * Breadcrumb WEB (design-system-components.md §11). Trilha de navegacao hierarquica.
 *
 * Estados (§11): item normal Inter 14/400 `fg-muted`; hover `brand-600` + sublinhado;
 * item atual `fg` peso 500, sem link; separador `/` em `fg-subtle`.
 *
 * O ultimo item e o atual (renderizado como `<span aria-current="page">`); os demais
 * com `href` viram `<a>`. A11y: `<nav aria-label>` + `<ol>`/`<li>`; separadores sao
 * `aria-hidden`. Todos os tokens de texto sao semanticos (adaptam light/dark); o
 * hover `brand-600` e agnostico de tema (marca).
 */
export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

export interface BreadcrumbProps {
  readonly items: readonly Crumb[];
  /** Rotulo do nav (padrao "Trilha de navegacao"). */
  readonly 'aria-label'?: string;
  readonly className?: string;
}

export function Breadcrumb({
  items,
  'aria-label': ariaLabel = 'Trilha de navegação',
  className,
}: BreadcrumbProps): ReactNode {
  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="flex flex-wrap items-center gap-2 font-body text-small">
        {items.map((item, i): ReactNode => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-2">
              {isLast ? (
                <span aria-current="page" className="font-medium text-fg">
                  {item.label}
                </span>
              ) : item.href != null ? (
                <a
                  href={item.href}
                  className={cn(
                    'rounded-sm text-fg-muted transition-colors duration-fast ease-standard',
                    'hover:text-brand-600 hover:underline',
                    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:ring-focus',
                  )}
                >
                  {item.label}
                </a>
              ) : (
                <span className="text-fg-muted">{item.label}</span>
              )}
              {isLast ? null : (
                <span aria-hidden="true" className="select-none text-fg-subtle">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

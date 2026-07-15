import type { ReactNode } from 'react';
import { useState } from 'react';

import { cn } from './cn';

/**
 * Menu lateral / Navegacao WEB (design-system-components.md §10). Lista vertical de
 * itens de navegacao (padrao dos paineis web-personal/web-admin).
 *
 * Estados (§10): normal (transparente, texto+icone `fg-muted`) / hover
 * (`neutral-100`, `fg`) / ativo (`brand-50` fundo, `brand-700` texto, `brand-600`
 * icone, barra 3px `brand-500` a esquerda) / foco (anel) / disabled (`fg-subtle`).
 *
 * Diferente das Tabs (§9): o menu e navegacao GERAL, sempre `brand` — nao usa o
 * acento de ambiente. O icone e um slot (`ReactNode`, SVG inline via `currentColor`)
 * ja que a familia lucide segue travada (§19). Itens com `href` viram `<a>`; sem
 * href, `<button>`. Controlavel (usa `value` se dado, senao estado interno).
 *
 * Inferencia dark (§10/§21 nao especificam): hover sobe um stop
 * (`neutral-100`->`neutral-800`, regra §21); o estado ativo (`brand-50`/`brand-700`/
 * `brand-600`/`brand-500`) e agnostico de tema, como o item selecionado do Select
 * (pilula de marca clara sobre o escuro). Registrada.
 */
export interface NavItem {
  readonly value: string;
  readonly label: string;
  /** Icone opcional (SVG inline usando `currentColor`). */
  readonly icon?: ReactNode;
  readonly href?: string;
  readonly disabled?: boolean;
}

export interface SideNavProps {
  readonly items: readonly NavItem[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly 'aria-label'?: string;
  readonly className?: string;
}

const itemBase = cn(
  'relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left font-body text-small',
  'transition-colors duration-fast ease-standard',
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:ring-focus',
);

function itemStateClasses(active: boolean, disabled: boolean): string {
  if (disabled) return 'cursor-not-allowed text-fg-subtle';
  if (active) return 'bg-brand-50 text-brand-700';
  return 'text-fg-muted hover:bg-neutral-100 hover:text-fg dark:hover:bg-neutral-800';
}

export function SideNav({
  items,
  value,
  defaultValue,
  onValueChange,
  'aria-label': ariaLabel,
  className,
}: SideNavProps): ReactNode {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const active = isControlled ? value : internal;

  const select = (item: NavItem): void => {
    if (item.disabled) return;
    if (!isControlled) setInternal(item.value);
    onValueChange?.(item.value);
  };

  return (
    <nav aria-label={ariaLabel} className={cn('flex flex-col gap-1', className)}>
      {items.map((item): ReactNode => {
        const isActive = item.value === active;
        const inner = (
          <>
            {isActive ? (
              <span
                aria-hidden="true"
                className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-brand-500"
              />
            ) : null}
            {item.icon != null ? (
              <span aria-hidden="true" className={cn('shrink-0', isActive && 'text-brand-600')}>
                {item.icon}
              </span>
            ) : null}
            <span className="truncate">{item.label}</span>
          </>
        );

        if (item.href != null && !item.disabled) {
          return (
            <a
              key={item.value}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => select(item)}
              className={cn(itemBase, itemStateClasses(isActive, false))}
            >
              {inner}
            </a>
          );
        }
        return (
          <button
            key={item.value}
            type="button"
            disabled={item.disabled}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => select(item)}
            className={cn(itemBase, itemStateClasses(isActive, item.disabled ?? false))}
          >
            {inner}
          </button>
        );
      })}
    </nav>
  );
}

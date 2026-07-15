import type { KeyboardEvent, ReactNode } from 'react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { cn } from './cn';

/**
 * Tabs WEB (design-system-components.md §9). Navegacao por abas com indicador
 * DESLIZANTE (2px) que anima entre as abas (`duration-normal`/`ease-standard`,
 * respeitando `prefers-reduced-motion`).
 *
 * Estados (§9): normal (`fg-muted`) / hover (`fg` + `neutral-50`) / ativo
 * (acento-700 + indicador acento-500) / foco (anel) / disabled (`fg-subtle`).
 *
 * Acento por ambiente (§9 + design-system.md §7): `brand` (padrao) ou os ambientes
 * `training`(lime) / `nutrition`(amber) / `medicine`(clinic) — o texto ativo e o
 * indicador usam o acento do ambiente, nao `brand`.
 *
 * A11y (baseline CLAUDE.md, padrao WAI-ARIA tablist): `role="tablist"`/`tab`,
 * `aria-selected`, roving tabindex, ativacao automatica por Setas/Home/End
 * (pula desabilitadas). Controlavel (usa `value` se dado, senao estado interno).
 *
 * Inferencia dark (§9/§21 nao especificam): fundo transparente do ativo tornaria o
 * texto `acento-700` ilegivel no escuro -> o texto ativo clareia para `acento-400`
 * (espelha o uso de `brand-400` no dark, §21); hover sobe um stop (`neutral-800`,
 * §21). O indicador (barra colorida) fica em `acento-500` nos dois temas. Registrada.
 */
export type TabsAccent = 'brand' | 'training' | 'nutrition' | 'medicine';

export interface TabItem {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly accent?: TabsAccent;
  readonly 'aria-label'?: string;
  readonly className?: string;
}

/** Texto ativo por acento (light -700; dark clareia para -400). */
const activeTextClasses: Record<TabsAccent, string> = {
  brand: 'text-brand-700 dark:text-brand-400',
  training: 'text-lime-700 dark:text-lime-400',
  nutrition: 'text-amber-700 dark:text-amber-400',
  medicine: 'text-clinic-700 dark:text-clinic-400',
};

/** Cor do indicador (barra 2px) por acento — agnostica de tema. */
const indicatorClasses: Record<TabsAccent, string> = {
  brand: 'bg-brand-500',
  training: 'bg-lime-500',
  nutrition: 'bg-amber-500',
  medicine: 'bg-clinic-500',
};

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  accent = 'brand',
  'aria-label': ariaLabel,
  className,
}: TabsProps): ReactNode {
  const isControlled = value !== undefined;
  const firstEnabled = items.find((i) => !i.disabled)?.value;
  const [internal, setInternal] = useState<string | undefined>(defaultValue ?? firstEnabled);
  const active = isControlled ? value : internal;

  const rootId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const activeIndex = items.findIndex((i) => i.value === active);

  const measure = useCallback((): void => {
    const el = tabRefs.current[activeIndex];
    const list = listRef.current;
    if (!el || !list) {
      setIndicator(null);
      return;
    }
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeIndex]);

  useLayoutEffect(measure, [measure, items]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const select = (val: string): void => {
    if (!isControlled) setInternal(val);
    onValueChange?.(val);
  };

  const focusTab = (index: number): void => {
    const el = tabRefs.current[index];
    el?.focus();
    const item = items[index];
    if (item) select(item.value);
  };

  const move = (from: number, dir: 1 | -1): void => {
    const n = items.length;
    for (let step = 1; step <= n; step++) {
      const i = (from + dir * step + n * step) % n;
      if (!items[i]?.disabled) {
        focusTab(i);
        return;
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(index, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(index, -1);
        break;
      case 'Home':
        e.preventDefault();
        move(-1, 1);
        break;
      case 'End':
        e.preventDefault();
        move(items.length, -1);
        break;
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn('relative flex gap-1 border-b border-line', className)}
    >
      {items.map((item, i): ReactNode => {
        const isActive = item.value === active;
        return (
          <button
            key={item.value}
            ref={(el): void => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${rootId}-tab-${item.value}`}
            aria-selected={isActive}
            disabled={item.disabled}
            tabIndex={isActive ? 0 : -1}
            onClick={() => select(item.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              'relative -mb-px rounded-t-sm px-4 py-2 font-body text-small font-medium',
              'transition-colors duration-fast ease-standard',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:ring-focus',
              'disabled:cursor-not-allowed disabled:text-fg-subtle',
              isActive
                ? activeTextClasses[accent]
                : 'text-fg-muted enabled:hover:bg-neutral-50 enabled:hover:text-fg dark:enabled:hover:bg-neutral-800',
            )}
          >
            {item.label}
          </button>
        );
      })}

      {indicator ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute bottom-0 h-0.5 rounded-full',
            indicatorClasses[accent],
            'transition-[left,width] duration-normal ease-standard motion-reduce:transition-none',
          )}
          style={{ left: indicator.left, width: indicator.width }}
        />
      ) : null}
    </div>
  );
}

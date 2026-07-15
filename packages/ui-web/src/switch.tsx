import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';

import { cn } from './cn';

/**
 * Switch WEB (design-system-components.md §6). Trilho 44×24, botao 20, raio full.
 * Input `checkbox` nativo escondido com `role="switch"` (semantica/teclado/foco) +
 * trilho/botao estilizados. Controlavel (usa `checked` se dado, senao estado
 * interno). Hover pela label (`group-hover`), foco pelo input (`peer-focus-
 * visible`). Dark de §6 nao especificado: neutros "sobem na rampa" (§21); a marca
 * e agnostica de tema.
 */
export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'>;

function trackClasses(on: boolean, disabled: boolean): string {
  if (disabled) return on ? 'bg-brand-200' : 'bg-neutral-200 dark:bg-neutral-700';
  return on
    ? 'bg-brand-500 group-hover:bg-brand-600'
    : 'bg-neutral-300 group-hover:bg-neutral-400 dark:bg-neutral-600 dark:group-hover:bg-neutral-500';
}

function thumbColor(on: boolean, disabled: boolean): string {
  if (disabled) return on ? 'bg-neutral-50' : 'bg-neutral-100 dark:bg-neutral-800';
  return 'bg-white';
}

export function Switch({
  checked,
  defaultChecked,
  disabled = false,
  onChange,
  className,
  children,
  ...props
}: SwitchProps): ReactNode {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState<boolean>(defaultChecked ?? false);
  const isOn = isControlled ? checked : internal;

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    if (!isControlled) setInternal(e.target.checked);
    onChange?.(e);
  };

  return (
    <label
      className={cn(
        'group inline-flex items-center gap-2',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={isOn}
        disabled={disabled}
        onChange={handleChange}
        {...props}
      />
      <span
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5',
          'transition-colors duration-fast ease-standard',
          'peer-focus-visible:outline-none peer-focus-visible:ring-[3px] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface peer-focus-visible:ring-focus',
          trackClasses(isOn, disabled),
        )}
      >
        <span
          className={cn(
            'pointer-events-none h-5 w-5 rounded-full shadow-subtle transition-transform duration-fast ease-standard',
            isOn ? 'translate-x-5' : 'translate-x-0',
            thumbColor(isOn, disabled),
          )}
        />
      </span>
      {children ? (
        <span className={cn('text-small text-fg', disabled && 'text-fg-subtle')}>{children}</span>
      ) : null}
    </label>
  );
}

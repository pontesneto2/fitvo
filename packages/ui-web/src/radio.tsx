import type { InputHTMLAttributes, ReactNode } from 'react';

import { cn } from './cn';

/**
 * Radio WEB (design-system-components.md §5). 20px, circular; ponto central em vez
 * de check. Input nativo escondido (semantica/teclado/AGRUPAMENTO por `name`) +
 * circulo estilizado. O estado selecionado e dirigido por CSS (`peer-checked`),
 * nao por estado interno — assim o agrupamento nativo (so um por grupo) funciona
 * controlado E nao-controlado. `disabled` (estatico) e resolvido por prop.
 *
 * Dark: §5 nao especifica; tokens semanticos de borda (`line`/`line-hover`/`line-
 * focus`, corretos nos dois temas) + neutros "sobem na rampa" (§21).
 */
export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  readonly error?: boolean;
}

const boxBase = cn(
  'grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px]',
  'transition-[background-color,border-color,box-shadow] duration-fast ease-standard',
  'peer-focus-visible:outline-none peer-focus-visible:ring-[3px] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface peer-focus-visible:ring-focus',
);

// Habilitado: estado por CSS (peer-checked) — reflete o grupo nativo.
const enabledBox = cn(
  'border-line-hover bg-transparent',
  'group-hover:border-brand-400 group-hover:bg-brand-50',
  'peer-focus-visible:border-line-focus',
  'peer-checked:border-brand-500 peer-checked:bg-white dark:peer-checked:bg-neutral-900',
);

function RadioDot({
  color,
  className,
}: {
  readonly color: string;
  readonly className?: string;
}): ReactNode {
  return (
    <span
      className={cn(
        'pointer-events-none absolute left-0 grid h-5 w-5 place-items-center',
        className,
      )}
      aria-hidden="true"
    >
      <span className={cn('h-2 w-2 rounded-full', color)} />
    </span>
  );
}

export function Radio({
  error = false,
  disabled = false,
  checked,
  defaultChecked,
  className,
  children,
  ...props
}: RadioProps): ReactNode {
  const staticSelected = (checked ?? defaultChecked) === true; // so usado quando disabled

  const boxCls = disabled
    ? staticSelected
      ? 'border-neutral-300 dark:border-neutral-600'
      : 'border-line bg-neutral-100 dark:bg-neutral-800'
    : error
      ? 'border-danger-400 group-hover:border-danger-400'
      : enabledBox;

  return (
    <label
      className={cn(
        'group relative inline-flex items-center gap-2',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <input
        type="radio"
        className="peer sr-only"
        disabled={disabled}
        checked={checked}
        defaultChecked={defaultChecked}
        aria-invalid={error || undefined}
        {...props}
      />
      <span className={cn(boxBase, boxCls)} aria-hidden="true" />
      {disabled ? (
        staticSelected ? (
          <RadioDot color="bg-neutral-300 dark:bg-neutral-600" />
        ) : null
      ) : (
        <RadioDot color="bg-brand-500" className="opacity-0 peer-checked:opacity-100" />
      )}
      {children ? (
        <span className={cn('text-small text-fg', disabled && 'text-fg-subtle')}>{children}</span>
      ) : null}
    </label>
  );
}

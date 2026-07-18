import { Check, Minus } from 'lucide-react';
import type { ChangeEvent, InputHTMLAttributes } from 'react';
import { forwardRef, useEffect, useRef, useState } from 'react';

import { cn } from './cn';
import { Icon } from './icon';
import { mergeRefs } from './merge-refs';

/**
 * Checkbox WEB (design-system-components.md §4). 20px, raio `sm`. Input nativo
 * escondido (`sr-only`) para semantica/teclado + caixa estilizada. Estado marcado/
 * indeterminado/disabled/erro vem de props (componente "controlavel": usa `checked`
 * se dado, senao um estado interno — funciona controlado e nao-controlado). Hover
 * pela label (`group-hover`), foco pelo input (`peer-focus-visible`).
 *
 * Dark: §4 nao especifica; aplico os tokens semanticos de borda (`line`/`line-
 * hover`/`line-focus`, corretos nos dois temas) e a regra "sobe na rampa" do §21
 * para os neutros de disabled. As cores de marca sao agnosticas de tema.
 *
 * `forwardRef`: encaminha o ref ao `<input>` (register do RHF — ADR-0005). O ref
 * interno (que seta `indeterminate`, que nao e atributo HTML) e FUNDIDO com o
 * encaminhado via `mergeRefs` — os dois apontam para o mesmo input.
 */
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  readonly error?: boolean;
  readonly indeterminate?: boolean;
}

const boxBase = cn(
  'grid h-5 w-5 shrink-0 place-items-center rounded-sm border-[1.5px]',
  'transition-[background-color,border-color,box-shadow] duration-fast ease-standard',
  'peer-focus-visible:outline-none peer-focus-visible:ring-[3px] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface peer-focus-visible:ring-focus',
);

function boxState(active: boolean, disabled: boolean, error: boolean): string {
  if (disabled) {
    return active
      ? 'border-neutral-300 bg-neutral-300 dark:border-neutral-600 dark:bg-neutral-600'
      : 'border-line bg-neutral-100 dark:bg-neutral-800';
  }
  if (active)
    return 'border-brand-500 bg-brand-500 group-hover:border-brand-600 group-hover:bg-brand-600';
  if (error) return 'border-danger-400 group-hover:border-danger-400';
  return 'border-line-hover bg-transparent group-hover:border-brand-400 group-hover:bg-brand-50 peer-focus-visible:border-line-focus';
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    checked,
    defaultChecked,
    indeterminate = false,
    error = false,
    disabled = false,
    onChange,
    className,
    children,
    ...props
  },
  forwardedRef,
) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState<boolean>(defaultChecked ?? false);
  const isChecked = isControlled ? checked : internal;
  const innerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    if (!isControlled) setInternal(e.target.checked);
    onChange?.(e);
  };

  const active = isChecked || indeterminate;

  return (
    <label
      className={cn(
        'group inline-flex items-center gap-2',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      )}
    >
      <input
        ref={mergeRefs(innerRef, forwardedRef)}
        type="checkbox"
        className="peer sr-only"
        checked={isChecked}
        disabled={disabled}
        aria-invalid={error || undefined}
        onChange={handleChange}
        {...props}
      />
      <span
        className={cn(
          boxBase,
          boxState(active, disabled, error),
          disabled ? 'text-neutral-50' : 'text-white',
        )}
      >
        {indeterminate ? (
          <Icon icon={Minus} size="sm" />
        ) : isChecked ? (
          <Icon icon={Check} size="sm" />
        ) : null}
      </span>
      {children ? (
        <span className={cn('text-small text-fg', disabled && 'text-fg-subtle')}>{children}</span>
      ) : null}
    </label>
  );
});

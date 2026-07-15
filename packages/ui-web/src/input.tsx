import type { InputHTMLAttributes, ReactNode } from 'react';

import { cn } from './cn';

/**
 * Input WEB (design-system-components.md §2 + dark §21). Campo de texto de linha
 * unica. Consome tokens via classes Tailwind do preset — zero hardcode. Estados
 * hover/foco/disabled/readonly por pseudo-classe CSS; o dark resolve pela cascata.
 *
 * As bordas usam os tokens semanticos (`border-line`/`line-hover`/`line-focus`),
 * ja corretos em light e dark (§0/§21). Superficies (fundo por estado) sao
 * explicitas porque nao mapeiam 1:1 num unico token semantico.
 *
 * Rotulo, texto de ajuda e mensagem de erro sao composicao (Field) — proximo passo.
 */
export type InputStatus = 'default' | 'error' | 'success';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Estado de validacao (§2). `error`/`success` colorem borda e fundo. */
  readonly status?: InputStatus;
}

const base = cn(
  'block h-md w-full rounded-sm border px-3 text-small font-body leading-none text-fg',
  'placeholder:text-fg-subtle',
  'transition-[color,background-color,border-color,box-shadow] duration-fast ease-standard',
  'focus:outline-none focus:ring-[3px] focus:ring-offset-2 focus:ring-offset-surface focus:ring-focus',
  'disabled:cursor-not-allowed disabled:text-fg-subtle',
  'read-only:cursor-default read-only:text-fg-muted',
);

const statusClasses: Record<InputStatus, string> = {
  default: cn(
    'border-line bg-neutral-50 dark:bg-neutral-800',
    'hover:border-line-hover',
    'focus:border-line-focus focus:bg-white dark:focus:bg-neutral-900',
    'disabled:border-line disabled:bg-neutral-100 dark:disabled:bg-neutral-800',
    'read-only:bg-neutral-100 dark:read-only:bg-neutral-800',
  ),
  error: cn(
    'border-danger-400 bg-danger-50 dark:bg-danger-900/20',
    'hover:border-danger-400 focus:border-danger-400',
  ),
  success: cn(
    'border-energy-500 bg-energy-50 dark:bg-energy-900/20',
    'hover:border-energy-500 focus:border-energy-500',
  ),
};

export function Input({ status = 'default', className, ...props }: InputProps): ReactNode {
  return (
    <input
      aria-invalid={status === 'error' || undefined}
      className={cn(base, statusClasses[status], className)}
      {...props}
    />
  );
}

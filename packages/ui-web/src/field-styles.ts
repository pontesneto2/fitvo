import { cn } from './cn';

/**
 * Estilos compartilhados por Input e Textarea (design-system-components.md §2 +
 * dark §21). Centraliza a decisao de token para os dois campos nao divergirem.
 * As bordas usam os tokens semanticos (`line`/`line-hover`/`line-focus`), corretos
 * em light e dark; as superficies por estado sao explicitas (nao mapeiam 1:1).
 */
export type FieldStatus = 'default' | 'error' | 'success';

/** Comum aos dois campos: borda, texto, placeholder, transicao, foco, disabled. */
export const fieldBase = cn(
  'w-full rounded-sm border px-3 font-body text-small text-fg',
  'placeholder:text-fg-subtle',
  'transition-[color,background-color,border-color,box-shadow] duration-fast ease-standard',
  'focus:outline-none focus:ring-[3px] focus:ring-offset-2 focus:ring-offset-surface focus:ring-focus',
  'disabled:cursor-not-allowed disabled:text-fg-subtle',
  'read-only:cursor-default read-only:text-fg-muted',
);

export const fieldStatusClasses: Record<FieldStatus, string> = {
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

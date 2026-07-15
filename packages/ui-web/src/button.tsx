import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from './cn';

/**
 * Button WEB (design-system-components.md §1). Consome os tokens via classes
 * Tailwind do preset (`fitvoTailwindPreset`) — zero hardcode. Estados hover/foco/
 * ativo/disabled sao pseudo-classes CSS; o dark e resolvido pela cascata (`.dark`),
 * nunca por inversao manual.
 *
 * Requer que o app: (1) use `fitvoTailwindPreset`; (2) inclua os arquivos deste
 * pacote no `content` do Tailwind, para as classes serem geradas.
 */
export type ButtonVariant = 'primary' | 'energy' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Intencao visual (§1). Padrao `primary`. */
  readonly variant?: ButtonVariant;
  /** Tamanho (altura/padding/fonte, §1). Padrao `md`. */
  readonly size?: ButtonSize;
  /** Mostra spinner e bloqueia a interacao, preservando a largura. */
  readonly loading?: boolean;
  readonly children?: ReactNode;
}

// Estrutura + transicao + foco (§0). Foco: anel de 3px, offset 2px, cor por
// variante; a cor de offset acompanha a superficie (branco no light, base no dark).
const base = cn(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
  'rounded-md font-body font-medium leading-none',
  'transition-[color,background-color,border-color,box-shadow,transform] duration-fast ease-standard',
  'active:scale-[0.98]',
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
  'disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none disabled:active:scale-100',
);

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-sm px-3 text-small',
  md: 'h-md px-4 text-small',
  lg: 'h-lg px-6 text-body',
};

// Uma variante por linha. Ordem: base -> hover -> ativo -> foco -> disabled.
const variantClasses: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-brand-500 text-white shadow-subtle',
    'hover:bg-brand-600 active:bg-brand-700',
    'focus-visible:ring-focus',
    'disabled:bg-neutral-200 disabled:text-fg-subtle',
  ),
  energy: cn(
    'bg-energy-400 text-brand-900 shadow-subtle',
    'hover:bg-energy-500 active:bg-energy-600 active:text-white',
    'focus-visible:ring-focus',
    'disabled:bg-neutral-200 disabled:text-fg-subtle',
  ),
  secondary: cn(
    'border border-line bg-transparent text-brand-600',
    'hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700',
    'active:border-brand-500 active:bg-brand-100 active:text-brand-800',
    'focus-visible:border-brand-500 focus-visible:ring-focus',
    'disabled:border-line disabled:bg-transparent disabled:text-fg-subtle',
  ),
  ghost: cn(
    'bg-transparent text-brand-600',
    'hover:bg-neutral-100 hover:text-brand-700',
    'active:bg-neutral-200 active:text-brand-800',
    'focus-visible:ring-focus',
    'disabled:bg-transparent disabled:text-fg-subtle',
  ),
  destructive: cn(
    'bg-danger-400 text-white',
    'hover:bg-danger-500 active:bg-danger-600',
    'focus-visible:ring-danger-200',
    'disabled:bg-neutral-200 disabled:text-fg-subtle',
  ),
};

function Spinner(): ReactNode {
  return (
    <span className="absolute inline-flex items-center justify-center" aria-hidden="true">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </span>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps): ReactNode {
  return (
    <button
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cn(base, sizeClasses[size], variantClasses[variant], className)}
      {...props}
    >
      {loading ? <Spinner /> : null}
      <span className={cn('inline-flex items-center gap-2', loading && 'opacity-0')}>
        {children}
      </span>
    </button>
  );
}

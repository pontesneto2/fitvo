import { iconStroke } from '@fitvo/brand-tokens';
import { AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from './button';
import { cn } from './cn';

/**
 * Estados de tela WEB (design-system-components.md §15): Skeleton (loading),
 * EmptyState (vazio) e ErrorState (erro). Sucesso e via Toast (§13) — nao e um
 * componente proprio aqui.
 *
 * EmptyState/ErrorState compoem o `Button` existente (reuso antes de criar).
 * Icones padrao sao Lucide (§19) em 48px — fora dos tokens `iconSize` (sm/md/lg,
 * pensados para icone inline/interativo), mas ainda no `iconStroke` (1.5) da
 * familia. Por isso usam o componente Lucide direto, nao o wrapper `Icon`.
 */

// --- Skeleton (loading) ---

export type SkeletonVariant = 'text' | 'rect' | 'circle';

export interface SkeletonProps {
  readonly variant?: SkeletonVariant;
  readonly width?: number | string;
  readonly height?: number | string;
  readonly className?: string;
}

const skeletonShape: Record<SkeletonVariant, string> = {
  text: 'h-3.5 w-full rounded-sm',
  rect: 'rounded-md',
  circle: 'rounded-full',
};

/**
 * Bloco de carregamento (§15): shimmer `neutral-100`->`neutral-200` em loop lento;
 * nunca um spinner solto em tela cheia. O shimmer de COR exato roda no mobile
 * (Animated); no web usamos o `pulse` nativo do Tailwind (opacidade) sobre
 * `neutral-200` para nao injetar keyframes globais nem dependencia — mesma leitura.
 * Respeita `prefers-reduced-motion`. Dark: `neutral-700` (§21 "sobe na rampa").
 */
export function Skeleton({ variant = 'rect', width, height, className }: SkeletonProps): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-700',
        skeletonShape[variant],
        className,
      )}
      style={{ width, height }}
    />
  );
}

// --- Icones padrao ---

function InboxIcon(): ReactNode {
  return (
    <Inbox size={48} strokeWidth={iconStroke} className="text-neutral-300" aria-hidden="true" />
  );
}

function AlertIcon(): ReactNode {
  return (
    <AlertTriangle
      size={48}
      strokeWidth={iconStroke}
      className="text-danger-400"
      aria-hidden="true"
    />
  );
}

const stateShell = cn('flex flex-col items-center justify-center gap-3 px-6 py-10 text-center');

// --- EmptyState (vazio) ---

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  /** Icone/ilustracao (padrao: caixa vazia em `neutral-300`). */
  readonly icon?: ReactNode;
  /** Acao primaria (ex.: um `<Button>`). */
  readonly action?: ReactNode;
  readonly className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps): ReactNode {
  return (
    <div className={cn(stateShell, className)}>
      <span className="mb-1">{icon ?? <InboxIcon />}</span>
      <h3 className="font-heading text-body font-medium text-fg">{title}</h3>
      {description ? <p className="max-w-sm text-small text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

// --- ErrorState (erro) ---

export interface ErrorStateProps {
  /** Titulo (padrao amigavel; nunca erro tecnico — ADR-0005). */
  readonly title?: string;
  /** Mensagem amigavel ao usuario. */
  readonly message?: string;
  readonly icon?: ReactNode;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
  readonly className?: string;
}

export function ErrorState({
  title = 'Algo deu errado',
  message = 'Não foi possível carregar. Tente novamente em instantes.',
  icon,
  onRetry,
  retryLabel = 'Tentar novamente',
  className,
}: ErrorStateProps): ReactNode {
  return (
    <div role="alert" className={cn(stateShell, className)}>
      <span className="mb-1">{icon ?? <AlertIcon />}</span>
      <h3 className="font-heading text-body font-medium text-fg">{title}</h3>
      {message ? <p className="max-w-sm text-small text-fg-muted">{message}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

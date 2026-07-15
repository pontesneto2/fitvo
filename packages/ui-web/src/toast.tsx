import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { cn } from './cn';

/**
 * Toast / Notificacao WEB (design-system-components.md §13). Componente de
 * apresentacao (`Toast`) + fila leve (`ToastProvider`/`useToast`) — sem dependencia
 * nova (React context + timers), espelhando o `ThemeProvider` do mobile.
 *
 * Visual (§13): raio `md`, padding `space-4`, sombra `raised`, borda-esquerda 3px
 * do acento da variante. Posicao topo-direita (web). Slide + fade
 * (`duration-normal`/`ease-out`, respeita `prefers-reduced-motion`). Auto-dismiss
 * 5s; a variante `error` nao fecha sozinha (fica ate acao do usuario).
 *
 * Variantes (§13): success (energy) / error (danger) / warning / info (clinic) /
 * achievement (lime). Texto: titulo Inter 14/500, descricao Inter 13/400.
 *
 * Inferencia dark (§13/§21 nao especificam): a superficie tingida (`*-50`) e o
 * acento sao AGNOSTICOS de tema (como o Badge, §8) — um cartao claro sobre o fundo.
 * Por isso o titulo/descricao fixam os tons ESCUROS do texto (`neutral-900`/
 * `neutral-600` = textPrincipal/textAuxiliar do light) nos dois temas, senao no
 * dark o texto clarearia e sumiria sobre a tinta clara. Registrada.
 */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'achievement';

export interface ToastData {
  readonly id: string;
  readonly variant?: ToastVariant;
  readonly title: string;
  readonly description?: string;
  /** ms ate o auto-dismiss. `null` = manual. Padrao 5000 (error -> null). */
  readonly duration?: number | null;
}

interface VariantStyle {
  readonly surface: string;
  readonly icon: string;
  readonly node: ReactNode;
}

function CheckGlyph(): ReactNode {
  return <path d="M13 4.5 6.5 11 3 7.5" />;
}
function AlertGlyph(): ReactNode {
  return (
    <>
      <path d="M8 4v5" />
      <path d="M8 11.5v.01" />
    </>
  );
}
function InfoGlyph(): ReactNode {
  return (
    <>
      <path d="M8 7.5v4.5" />
      <path d="M8 4.5v.01" />
    </>
  );
}
function StarGlyph(): ReactNode {
  return <path d="M8 2.5l1.6 3.4 3.7.5-2.7 2.6.7 3.7L8 11.4 4.7 13.2l.7-3.7L2.7 6.9l3.7-.5z" />;
}

const VARIANTS: Record<ToastVariant, VariantStyle> = {
  success: {
    surface: 'bg-energy-50 border-l-energy-500',
    icon: 'text-energy-600',
    node: <CheckGlyph />,
  },
  error: {
    surface: 'bg-danger-50 border-l-danger-400',
    icon: 'text-danger-600',
    node: <AlertGlyph />,
  },
  warning: {
    surface: 'bg-warning-50 border-l-warning-400',
    icon: 'text-warning-600',
    node: <AlertGlyph />,
  },
  info: {
    surface: 'bg-clinic-50 border-l-clinic-400',
    icon: 'text-clinic-600',
    node: <InfoGlyph />,
  },
  achievement: {
    surface: 'bg-lime-50 border-l-lime-400',
    icon: 'text-lime-600',
    node: <StarGlyph />,
  },
};

function ToastIcon({ variant }: { readonly variant: ToastVariant }): ReactNode {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('mt-0.5 h-4 w-4 shrink-0', VARIANTS[variant].icon)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {VARIANTS[variant].node}
    </svg>
  );
}

function XIcon(): ReactNode {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M3.5 3.5l7 7M10.5 3.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface ToastProps {
  readonly variant?: ToastVariant;
  readonly title: string;
  readonly description?: string;
  readonly onClose?: () => void;
  readonly closeLabel?: string;
  readonly className?: string;
}

/** Cartao visual do toast (presentacional puro; sem timer). */
export function Toast({
  variant = 'info',
  title,
  description,
  onClose,
  closeLabel = 'Fechar',
  className,
}: ToastProps): ReactNode {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'flex w-80 items-start gap-3 rounded-md border-l-[3px] p-4 shadow-raised',
        VARIANTS[variant].surface,
        className,
      )}
    >
      <ToastIcon variant={variant} />
      <div className="min-w-0 flex-1">
        <p className="font-body text-small font-medium text-neutral-900">{title}</p>
        {description ? (
          <p className="mt-0.5 font-body text-footnote text-neutral-600">{description}</p>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className={cn(
            '-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-neutral-500',
            'transition-colors duration-fast ease-standard hover:bg-neutral-900/5 hover:text-neutral-700',
            'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-1 focus-visible:ring-focus',
          )}
        >
          <XIcon />
        </button>
      ) : null}
    </div>
  );
}

// --- Fila (provider + hook) ---

interface ToastContextValue {
  readonly toast: (data: Omit<ToastData, 'id'>) => string;
  readonly dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;
function nextId(): string {
  counter += 1;
  return `toast-${counter}`;
}

function ToastItem({
  data,
  onDismiss,
}: {
  readonly data: ToastData;
  readonly onDismiss: (id: string) => void;
}): ReactNode {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const resolvedDuration =
    data.duration === undefined ? (data.variant === 'error' ? null : 5000) : data.duration;

  useEffect(() => {
    if (resolvedDuration == null) return;
    const t = window.setTimeout(() => onDismiss(data.id), resolvedDuration);
    return () => window.clearTimeout(t);
  }, [resolvedDuration, data.id, onDismiss]);

  return (
    <div
      className={cn(
        'transition-[opacity,transform] duration-normal ease-out motion-reduce:transition-none',
        entered ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0',
      )}
    >
      <Toast
        title={data.title}
        onClose={() => onDismiss(data.id)}
        {...(data.variant ? { variant: data.variant } : {})}
        {...(data.description ? { description: data.description } : {})}
      />
    </div>
  );
}

export interface ToastProviderProps {
  readonly children: ReactNode;
}

/** Fornece `useToast()` e renderiza o viewport (topo-direita). */
export function ToastProvider({ children }: ToastProviderProps): ReactNode {
  const [items, setItems] = useState<readonly ToastData[]>([]);
  const dismiss = useCallback((id: string): void => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const toast = useCallback((data: Omit<ToastData, 'id'>): string => {
    const id = nextId();
    setItems((prev) => [...prev, { ...data, id }]);
    return id;
  }, []);

  const valueRef = useRef<ToastContextValue>({ toast, dismiss });
  valueRef.current = { toast, dismiss };

  return (
    <ToastContext.Provider value={valueRef.current}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        {items.map((t): ReactNode => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem data={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Empurra/remove toasts. Lanca se usado fora do `<ToastProvider>`. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error('useToast deve ser usado dentro de <ToastProvider>.');
  }
  return ctx;
}

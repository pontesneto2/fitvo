import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from './cn';

/**
 * Modal / Dialog WEB (design-system-components.md §12). Overlay com foco preso
 * (focus trap) — OBRIGATORIO.
 *
 * - Overlay: token `scrim` (`neutral-900` a 60% + blur 4px).
 * - Painel: `surface-raised` (branco / `neutral-800`), raio `lg`, sombra `overlay`
 *   (o modal PEDE atencao), padding `space-6`. Larguras sm 400 / md 560 / lg 720.
 * - Entrada: fade + scale 0.96->1 (`duration-normal`/`ease-out`). Saida: fade +
 *   scale 1->0.98 (`duration-fast`/`ease-in`). Respeita `prefers-reduced-motion`.
 * - Fecha por: `Esc`, clique no overlay e botao explicito (× no cabecalho).
 * - Foco: ao abrir, guarda o elemento ativo e move o foco para o painel (ou
 *   `initialFocusRef`); `Tab`/`Shift+Tab` circulam DENTRO do painel; ao fechar,
 *   devolve o foco ao elemento de origem. `role="dialog"` + `aria-modal`.
 * - Titulo: Poppins 18/600 `fg` (quando `title` e dado, vira `aria-labelledby`).
 *
 * Sem portal e sem dependencia nova: o overlay e `position: fixed inset-0` (fica
 * preso a viewport) — mantem o pacote so com `react` como peer (trava do CLAUDE.md).
 */
export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Titulo (vira `aria-labelledby`). Se ausente, informe `aria-label`. */
  readonly title?: string;
  readonly size?: ModalSize;
  /** Elemento que recebe o foco inicial (padrao: o proprio painel). */
  readonly initialFocusRef?: React.RefObject<HTMLElement>;
  /** Mostra o botao × de fechar no cabecalho (padrao true). */
  readonly showClose?: boolean;
  readonly closeLabel?: string;
  readonly 'aria-label'?: string;
  readonly children?: ReactNode;
  /** Rodape opcional (ex.: botoes de acao). */
  readonly footer?: ReactNode;
  readonly className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-[400px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function XIcon(): ReactNode {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  initialFocusRef,
  showClose = true,
  closeLabel = 'Fechar',
  'aria-label': ariaLabel,
  children,
  footer,
  className,
}: ModalProps): ReactNode {
  const [rendered, setRendered] = useState(open);
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const titleId = useId();

  // Monta/desmonta com animacao de entrada e saida (mantem no DOM ate a saida).
  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const t = window.setTimeout(() => setRendered(false), 150); // duration-fast
    return () => window.clearTimeout(t);
  }, [open]);

  // Foco inicial + trava de rolagem do body enquanto aberto.
  useEffect(() => {
    if (!rendered || !open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const target = initialFocusRef?.current ?? panelRef.current;
    target?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [rendered, open, initialFocusRef]);

  const trapTab = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === panel,
      );
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && (activeEl === first || activeEl === panel)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first?.focus();
      }
    },
    [onClose],
  );

  if (!rendered) return null;

  const onOverlayMouseDown = (e: MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-[4px]',
        'transition-opacity duration-normal ease-out motion-reduce:transition-none',
        entered ? 'opacity-100' : 'opacity-0',
      )}
      onMouseDown={onOverlayMouseDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={cn(
          'w-full rounded-lg bg-surface-raised p-6 shadow-overlay outline-none',
          'transition-[opacity,transform] ease-out motion-reduce:transition-none',
          entered
            ? 'scale-100 opacity-100 duration-normal'
            : 'scale-[0.98] opacity-0 duration-fast ease-in',
          sizeClasses[size],
          className,
        )}
      >
        {(title || showClose) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            {title ? (
              <h2 id={titleId} className="font-heading text-h3 font-semibold text-fg">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {showClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className={cn(
                  '-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted',
                  'transition-colors duration-fast ease-standard hover:bg-neutral-100 hover:text-fg dark:hover:bg-neutral-700',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised focus-visible:ring-focus',
                )}
              >
                <XIcon />
              </button>
            ) : null}
          </div>
        )}

        <div className="text-small text-fg-muted">{children}</div>

        {footer ? <div className="mt-6 flex items-center justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

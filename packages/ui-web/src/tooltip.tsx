import type { FocusEvent, ReactElement, ReactNode } from 'react';
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { cn } from './cn';

/**
 * Tooltip WEB (design-system-components.md §14). Dica contextual sobre um gatilho.
 *
 * Visual (§14): fundo/texto pelos tokens semanticos `tooltip`/`tooltip-fg`
 * (neutral-800/neutral-50 no light, neutral-100/neutral-900 no dark — ja invertem
 * por tema), raio `sm`, padding `space-2`, sombra `subtle`, Inter 12/400. Abre em
 * 400ms, fecha em 100ms. Fade + slide 4px (`duration-fast`, respeita
 * `prefers-reduced-motion`).
 *
 * Aparece no hover E no foco do gatilho (teclado). `role="tooltip"` + o gatilho
 * recebe `aria-describedby` enquanto visivel. NUNCA e o unico meio de informacao
 * essencial (§14) — e complemento.
 */
export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  readonly content: ReactNode;
  readonly side?: TooltipSide;
  /** Elemento gatilho (unico filho focavel). */
  readonly children: ReactElement;
  readonly openDelay?: number;
  readonly closeDelay?: number;
}

const sideClasses: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

/** Deslocamento de entrada (slide 4px) na direcao oposta ao lado. */
const enterOffset: Record<TooltipSide, string> = {
  top: 'translate-y-1',
  bottom: '-translate-y-1',
  left: 'translate-x-1',
  right: '-translate-x-1',
};

export function Tooltip({
  content,
  side = 'top',
  children,
  openDelay = 400,
  closeDelay = 100,
}: TooltipProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const tooltipId = useId();

  const clearTimer = (): void => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
  };

  const show = useCallback((): void => {
    clearTimer();
    timer.current = window.setTimeout(() => setOpen(true), openDelay);
  }, [openDelay]);

  const hide = useCallback((): void => {
    clearTimer();
    timer.current = window.setTimeout(() => setOpen(false), closeDelay);
  }, [closeDelay]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => clearTimer, []);

  // Esc fecha imediatamente (padrao WAI-ARIA tooltip).
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      clearTimer();
      setOpen(false);
    }
  };

  const trigger = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{ 'aria-describedby'?: string }>,
        open ? { 'aria-describedby': tooltipId } : {},
      )
    : children;

  const onBlur = (e: FocusEvent<HTMLSpanElement>): void => {
    // So esconde se o foco saiu do wrapper inteiro.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide();
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      {trigger}
      {open ? (
        <span
          role="tooltip"
          id={tooltipId}
          className={cn(
            'pointer-events-none absolute z-50 w-max max-w-xs rounded-sm bg-tooltip px-2 py-1 shadow-subtle',
            'font-body text-caption text-tooltip-fg',
            'transition-[opacity,transform] duration-fast ease-out motion-reduce:transition-none',
            sideClasses[side],
            entered ? 'opacity-100' : cn('opacity-0', enterOffset[side]),
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

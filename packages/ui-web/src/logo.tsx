import { logoMarkSize } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';

import { cn } from './cn';

/**
 * Logo WEB (design-system.md §9 / design-system-components.md §20 — "Logo"
 * segue [A DEFINIR]: o simbolo final ainda nao existe). Este componente cobre
 * o que JA esta fechado — o wordmark (Poppins, "FIT" em `brand-500` / "VO" em
 * `energy-400`, cor primaria `#0FA678`) — e expoe um mark PROVISORIO (forma
 * geometrica, sem simbolo de marca) para nao deixar o slot vazio enquanto o
 * simbolo nao e decidido. Trocar `mark` por um SVG real quando o simbolo
 * fechar nao muda a API do componente.
 */
export type LogoSizeName = 'sm' | 'md' | 'lg';

const wordmarkTextClass = {
  sm: 'text-h3',
  md: 'text-h2',
  lg: 'text-h1',
} as const satisfies Record<LogoSizeName, string>;

export interface LogoProps {
  readonly size?: LogoSizeName;
  /** Oculta o mark geometrico provisorio, mostrando so o wordmark. */
  readonly showMark?: boolean;
  readonly className?: string;
}

/** Mark geometrico PROVISORIO — dois blocos sobrepostos nas cores da marca. */
function ProvisionalMark({ size }: { readonly size: LogoSizeName }): ReactNode {
  const box = logoMarkSize[size];
  return (
    <span
      aria-hidden="true"
      className="relative inline-block shrink-0"
      style={{ width: box, height: box }}
    >
      <span
        className="absolute inset-0 rounded-md bg-brand-500"
        style={{ transform: 'rotate(0deg)' }}
      />
      <span
        className="absolute rounded-sm bg-energy-400"
        style={{
          width: box * 0.5,
          height: box * 0.5,
          right: -box * 0.12,
          bottom: -box * 0.12,
        }}
      />
    </span>
  );
}

export function Logo({ size = 'md', showMark = true, className }: LogoProps): ReactNode {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {showMark ? <ProvisionalMark size={size} /> : null}
      <span
        className={cn('font-heading font-semibold leading-none', wordmarkTextClass[size])}
        aria-label="FITVO"
      >
        <span className="text-brand-500">FIT</span>
        <span className="text-energy-400">VO</span>
      </span>
    </span>
  );
}

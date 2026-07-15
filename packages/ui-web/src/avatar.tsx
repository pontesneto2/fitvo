import { avatarSize } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { Children, useState } from 'react';

import { cn } from './cn';

/**
 * Avatar WEB (design-system-components.md §18). Foto do usuario com fallback de
 * iniciais.
 *
 * Tamanhos (token `avatarSize`): xs 24 / sm 32 / md 40 / lg 56 / xl 80. Raio `full`.
 * Fallback (§18): iniciais em `brand-100` com texto `brand-700`, Poppins 500. Borda
 * opcional 2px branca (`bordered`) para sobreposicoes/grupos.
 *
 * Se `src` falhar ao carregar (ou ausente), cai automaticamente para as iniciais
 * derivadas de `name`. O tamanho da fonte das iniciais e proporcional ao diametro
 * (derivado do token, nao chumbado). `name` vira o texto acessivel (`alt`/`aria`).
 */
export type AvatarSizeName = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  readonly name: string;
  readonly src?: string;
  readonly size?: AvatarSizeName;
  /** Borda branca de 2px (para grupos/sobreposicoes). */
  readonly bordered?: boolean;
  readonly className?: string;
}

/** Iniciais: 1a letra da primeira e da ultima palavra (ate 2), em maiuscula. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase();
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 'md',
  bordered = false,
  className,
}: AvatarProps): ReactNode {
  const [failed, setFailed] = useState(false);
  const diameter = avatarSize[size];
  const showImg = src != null && src !== '' && !failed;

  const box = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full align-middle',
    bordered && 'border-2 border-white',
    className,
  );

  if (showImg) {
    return (
      <img
        src={src}
        alt={name}
        width={diameter}
        height={diameter}
        onError={() => setFailed(true)}
        className={cn(box, 'object-cover')}
        style={{ width: diameter, height: diameter }}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={cn(box, 'select-none bg-brand-100 font-heading font-medium text-brand-700')}
      style={{ width: diameter, height: diameter, fontSize: Math.round(diameter * 0.4) }}
    >
      {getInitials(name)}
    </span>
  );
}

// --- Grupo de avatares (sobreposicao) ---

export interface AvatarGroupProps {
  readonly size?: AvatarSizeName;
  /** Maximo de avatares antes de mostrar "+N". */
  readonly max?: number;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Empilha avatares sobrepostos (borda branca aplicada automaticamente). Alem de
 * `max`, condensa o excedente num contador "+N" (que reusa o proprio Avatar).
 */
export function AvatarGroup({
  size = 'md',
  max,
  children,
  className,
}: AvatarGroupProps): ReactNode {
  const all = Children.toArray(children);
  const shown = max != null ? all.slice(0, max) : all;
  const overflow = max != null ? all.length - max : 0;
  const diameter = avatarSize[size];
  const overlap = Math.round(diameter * 0.3);

  return (
    <div className={cn('flex items-center', className)}>
      {shown.map((child, i): ReactNode => (
        <span
          key={i}
          className="rounded-full ring-2 ring-white"
          style={{ marginLeft: i === 0 ? 0 : -overlap }}
        >
          {child}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          role="img"
          aria-label={`Mais ${overflow}`}
          className="inline-flex select-none items-center justify-center rounded-full bg-brand-100 font-heading font-medium text-brand-700 ring-2 ring-white"
          style={{
            width: diameter,
            height: diameter,
            marginLeft: -overlap,
            fontSize: Math.round(diameter * 0.36),
          }}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

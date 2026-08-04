'use client';

import { Icon, Input } from '@fitvo/ui-web';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Campo de busca: o `Input` do design system com o icone de lupa sobreposto.
 *
 * COMPOSICAO, nao componente novo: a §2 do design-system-components.md nao
 * especifica slot de icone no Input, e inventar um la seria mexer na API do DS
 * por causa de duas telas. Aqui o Input continua sendo o do DS — o icone e
 * decoracao posicionada por cima, com o padding compensado.
 */
export interface SearchInputProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly placeholder?: string;
  readonly 'aria-label': string;
  readonly className?: string;
}

export function SearchInput({
  value,
  onValueChange,
  placeholder,
  'aria-label': ariaLabel,
  className,
}: SearchInputProps): ReactNode {
  return (
    <div className={`relative ${className ?? ''}`}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
      >
        <Icon icon={Search} size="sm" />
      </span>
      <Input
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-9"
      />
    </div>
  );
}

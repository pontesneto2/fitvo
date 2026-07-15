import type { InputHTMLAttributes, ReactNode } from 'react';

import { cn } from './cn';
import type { FieldStatus } from './field-styles';
import { fieldBase, fieldStatusClasses } from './field-styles';

/**
 * Input WEB (design-system-components.md §2 + dark §21). Campo de texto de linha
 * unica. Estilos compartilhados com Textarea vivem em `field-styles.ts`; aqui so o
 * que e especifico de linha unica (altura fixa, sem quebra).
 */
export type InputStatus = FieldStatus;

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Estado de validacao (§2). `error`/`success` colorem borda e fundo. */
  readonly status?: InputStatus;
}

export function Input({ status = 'default', className, ...props }: InputProps): ReactNode {
  return (
    <input
      aria-invalid={status === 'error' || undefined}
      className={cn(fieldBase, 'block h-md leading-none', fieldStatusClasses[status], className)}
      {...props}
    />
  );
}

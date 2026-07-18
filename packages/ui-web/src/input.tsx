import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from './cn';
import type { FieldStatus } from './field-styles';
import { fieldBase, fieldStatusClasses } from './field-styles';

/**
 * Input WEB (design-system-components.md §2 + dark §21). Campo de texto de linha
 * unica. Estilos compartilhados com Textarea vivem em `field-styles.ts`; aqui so o
 * que e especifico de linha unica (altura fixa, sem quebra).
 *
 * `forwardRef` encaminha o ref ao `<input>` nativo — habilita o `register()`
 * uncontrolled do React Hook Form (ADR-0005).
 */
export type InputStatus = FieldStatus;

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Estado de validacao (§2). `error`/`success` colorem borda e fundo. */
  readonly status?: InputStatus;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { status = 'default', className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={status === 'error' || undefined}
      className={cn(fieldBase, 'block h-md leading-none', fieldStatusClasses[status], className)}
      {...props}
    />
  );
});

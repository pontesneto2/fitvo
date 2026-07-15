import type { ReactElement, ReactNode } from 'react';
import { cloneElement, useId } from 'react';

import { cn } from './cn';

/**
 * Field WEB (design-system-components.md §2). Compoe rotulo + controle + ajuda/erro
 * e faz o wiring de acessibilidade: gera o `id`, liga `aria-describedby` a ajuda/
 * erro e, quando ha `error`, injeta `aria-invalid` e `status="error"` no controle
 * (Input/Textarea) — o campo fica vermelho sem o consumidor repetir o status.
 *
 * Rotulo Inter 14/500 `text-auxiliar` (space-2 acima); ajuda/erro Inter 12/400
 * (`text-sutil` / `danger-700`), space-1 abaixo.
 */
export interface FieldProps {
  readonly label?: ReactNode;
  /** Texto de ajuda (oculto quando ha erro). */
  readonly description?: ReactNode;
  /** Mensagem de erro; presente => campo em estado de erro. */
  readonly error?: ReactNode;
  readonly required?: boolean;
  readonly className?: string;
  /** O controle: Input, Textarea, Select... Recebe id/aria/status via clone. */
  readonly children: ReactElement;
}

export function Field({
  label,
  description,
  error,
  required = false,
  className,
  children,
}: FieldProps): ReactNode {
  const autoId = useId();
  const childProps = children.props as { id?: string };
  const controlId = childProps.id ?? autoId;
  const descId = `${controlId}-desc`;
  const errId = `${controlId}-err`;

  const hasError = error !== undefined && error !== null && error !== false;
  // Descreve apenas o que esta renderizado: no erro, a ajuda some (so o erro conta).
  const describedBy = hasError ? errId : description ? descId : '';

  const controlProps: Record<string, unknown> = { id: controlId };
  if (describedBy) controlProps['aria-describedby'] = describedBy;
  if (hasError) {
    controlProps['aria-invalid'] = true;
    controlProps['status'] = 'error';
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label ? (
        <label htmlFor={controlId} className="text-small font-medium text-fg-muted">
          {label}
          {required ? <span className="text-danger-500"> *</span> : null}
        </label>
      ) : null}
      <div className="flex flex-col gap-1">
        {cloneElement(children, controlProps)}
        {hasError ? (
          <p id={errId} className="text-caption text-danger-700 dark:text-danger-400">
            {error}
          </p>
        ) : description ? (
          <p id={descId} className="text-caption text-fg-subtle">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

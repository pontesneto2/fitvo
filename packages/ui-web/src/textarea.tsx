import type { TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from './cn';
import type { FieldStatus } from './field-styles';
import { fieldBase, fieldStatusClasses } from './field-styles';

/**
 * Textarea WEB (design-system-components.md §2). Campo multilinha — mesmos tokens
 * de estado do Input (via `field-styles.ts`), com altura minima de 80px, padding
 * vertical e altura de linha de corpo (nao `leading-none`, que e so p/ linha unica).
 *
 * `forwardRef` encaminha o ref ao `<textarea>` nativo (register do RHF — ADR-0005).
 */
export type TextareaStatus = FieldStatus;

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly status?: TextareaStatus;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { status = 'default', className, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={status === 'error' || undefined}
      className={cn(
        fieldBase,
        'block min-h-[80px] resize-y py-2 leading-normal',
        fieldStatusClasses[status],
        className,
      )}
      {...props}
    />
  );
});

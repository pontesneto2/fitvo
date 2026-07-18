import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

/**
 * Resolver React Hook Form a partir de um schema Zod, sem a dependencia
 * `@hookform/resolvers` (evita risco de compat com o Zod v4 do repo). Suficiente
 * para formularios de campos planos, como o login.
 */
export function zodResolver<T extends FieldValues>(schema: ZodType<T>): Resolver<T> {
  return (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || 'root';
      errors[path] ??= { type: String(issue.code), message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}

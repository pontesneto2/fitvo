import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

/**
 * Resolver React Hook Form a partir de um schema Zod, sem a dependencia
 * `@hookform/resolvers` (evita risco de compat com o Zod v4 do repo).
 *
 * Constroi o objeto de erros de forma ANINHADA (`errors.address.cep`,
 * `errors.acceptedTerms.termsOfUse`), seguindo o `issue.path` do Zod — o RHF le
 * os erros por caminho aninhado, entao uma chave "achatada" (`'address.cep'`)
 * nunca apareceria na tela. Cobre campos planos (login) e aninhados (cadastro).
 */
function setNestedError(
  root: Record<string, unknown>,
  path: PropertyKey[],
  value: { type: string; message: string },
): void {
  let node = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = String(path[i]);
    if (typeof node[key] !== 'object' || node[key] === null) {
      node[key] = {};
    }
    node = node[key] as Record<string, unknown>;
  }
  const leaf = String(path[path.length - 1]);
  // Primeiro erro por campo vence (nao sobrescreve).
  node[leaf] ??= value;
}

export function zodResolver<T extends FieldValues>(schema: ZodType<T>): Resolver<T> {
  return (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path : ['root'];
      setNestedError(errors, path, { type: String(issue.code), message: issue.message });
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}

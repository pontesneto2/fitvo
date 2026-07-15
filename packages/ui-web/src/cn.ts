/**
 * Junta classes condicionais numa string, ignorando valores falsy. Utilitario
 * minimo (sem dependencia externa: nao trazemos clsx/cva sem ordem — trava do
 * CLAUDE.md). Nao faz merge/dedup de utilitarios Tailwind conflitantes; a ordem
 * de composicao nos componentes ja evita conflito.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

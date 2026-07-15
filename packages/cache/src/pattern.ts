/**
 * Traduz um glob de cache no estilo Redis (`*`, `?`) para RegExp, escapando os
 * demais metacaracteres. Usado pela store em memoria para espelhar a semantica
 * de `invalidate(pattern)` do Redis (que faz o match nativamente via SCAN MATCH).
 */
export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const body = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${body}$`);
}

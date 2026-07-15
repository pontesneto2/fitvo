import { semanticColors } from './semantic-colors';

/**
 * Anel de foco (design-system-components.md §0) — obrigatorio em todo elemento
 * interativo; nunca remover outline sem substituir por anel equivalente. A cor e
 * o token semantico `focusRing` (resolve light/dark via theme.ts); largura e
 * offset sao agnosticos de tema.
 */
export const focusRing = {
  width: 3,
  offset: 2,
  color: semanticColors.focusRing,
} as const;

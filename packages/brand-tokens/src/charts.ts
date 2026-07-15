import { colors } from './colors';
import { semanticColors } from './semantic-colors';

/**
 * Visualizacao de dados (design-system-components.md §17). A ordem das cores das
 * series garante distincao visual; cor nunca e o unico diferenciador (combinar
 * com padrao/icone/label — acessibilidade daltonica).
 */
export const chartSeries = [
  colors.brand[500],
  colors.clinic[400],
  colors.amber[400],
  colors.purple[400],
  colors.pink[400],
  colors.cyan[400],
  colors.lime[500],
  colors.energy[500],
] as const;

/** Grid/eixos dos graficos. */
export const chartGrid = colors.neutral[200];

/** Cor de label/eixo (texto sutil, semantico light/dark). */
export const chartLabel = semanticColors.textSutil;

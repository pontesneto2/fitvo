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

/**
 * Grid/eixos dos graficos. §17 so fixa o light (`neutral-200`); dark NAO
 * especificado — inferencia registrada: reusa `borderDefault` (mesmo par
 * light/dark, regra §21 "sobe na rampa" ja aplicada a bordas/linhas finas).
 */
export const chartGrid = semanticColors.borderDefault;

/** Cor de label/eixo (texto sutil, semantico light/dark). */
export const chartLabel = semanticColors.textSutil;

/**
 * Config de uma serie de grafico (compartilhado entre ui-web/ui-mobile — logica
 * pura, TS cru, sem dependencia de framework). §17: cor NUNCA e o unico
 * diferenciador — por isso cada serie de linha tambem recebe um padrao de traco
 * distinto por indice, alem da cor.
 */
export interface ChartSeriesConfig {
  readonly key: string;
  readonly label: string;
  /** `strokeDasharray` (SVG). Se omitido, usa o padrao do indice (`dashPatterns`). */
  readonly dash?: string;
}

/** Padroes de traco por indice — solido primeiro (serie principal), tracejados depois. */
export const dashPatterns = ['0', '6 3', '2 2', '8 3 2 3', '1 3', '10 2 2 2'] as const;

export function seriesColor(index: number): string {
  // index % length e sempre um indice valido; o ?? so satisfaz noUncheckedIndexedAccess.
  return chartSeries[index % chartSeries.length] ?? chartSeries[0];
}

export function dashPattern(config: ChartSeriesConfig, index: number): string {
  return config.dash ?? dashPatterns[index % dashPatterns.length] ?? dashPatterns[0];
}

import type { ChartSeriesConfig } from '@fitvo/brand-tokens';
import { dashPattern, seriesColor } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { Dimensions } from 'react-native';
import { VictoryAxis, VictoryChart, VictoryLegend, VictoryLine } from 'victory-native';

import { useTheme } from './theme-context';

/**
 * Grafico de linha MOBILE (design-system-components.md §17). Wrapper fino sobre
 * `victory-native` (v36 — SVG puro via `react-native-svg`, sem Skia/Reanimated;
 * a XL/v41 exige essas dependencias nativas pesadas e nao foi adotada — nao ha
 * app RN real ainda pra validar um build nativo). Mesma logica de cor/traco do
 * `chart-line` web (`seriesColor`/`dashPattern`, `@fitvo/brand-tokens`); grid/eixo
 * via `useTheme()` (RN nao tem `currentColor`/CSS var, resolve sempre um valor
 * concreto pro tema ativo).
 */
export interface LineChartProps {
  readonly data: readonly Record<string, number | string>[];
  readonly xKey: string;
  readonly series: readonly ChartSeriesConfig[];
  readonly height?: number;
  readonly width?: number;
}

export function LineChart({ data, xKey, series, height = 240, width }: LineChartProps): ReactNode {
  const theme = useTheme();
  const grid = theme.colors.borderDefault;
  const label = theme.colors.textSutil;
  const chartWidth = width ?? Dimensions.get('window').width - 32;

  return (
    <VictoryChart width={chartWidth} height={height} domainPadding={{ x: 16, y: 12 }}>
      <VictoryAxis
        style={{
          axis: { stroke: grid },
          grid: { stroke: 'transparent' },
          tickLabels: { fill: label, fontSize: 12 },
        }}
      />
      <VictoryAxis
        dependentAxis
        style={{
          axis: { stroke: 'transparent' },
          grid: { stroke: grid },
          tickLabels: { fill: label, fontSize: 12 },
        }}
      />
      {series.map((s, i) => (
        <VictoryLine
          key={s.key}
          data={[...data]}
          x={xKey}
          y={s.key}
          style={{
            data: { stroke: seriesColor(i), strokeWidth: 2, strokeDasharray: dashPattern(s, i) },
          }}
        />
      ))}
      <VictoryLegend
        orientation="horizontal"
        gutter={16}
        style={{ labels: { fill: label, fontSize: 12 } }}
        data={series.map((s, i) => ({ name: s.label, symbol: { fill: seriesColor(i) } }))}
      />
    </VictoryChart>
  );
}

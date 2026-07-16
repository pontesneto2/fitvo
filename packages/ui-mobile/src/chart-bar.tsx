import type { ChartSeriesConfig } from '@fitvo/brand-tokens';
import { radius, seriesColor } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { Dimensions } from 'react-native';
import { VictoryAxis, VictoryBar, VictoryChart, VictoryGroup, VictoryLegend } from 'victory-native';

import { useTheme } from './theme-context';

/**
 * Grafico de barra MOBILE (design-system-components.md §17). Mesmos tokens do
 * `chart-line` mobile. `VictoryGroup` com `offset` p/ series multiplas lado a
 * lado (a alternativa ao padrao de traco do line — barra preenchida nao aceita
 * dasharray; o diferenciador alem da cor e a `VictoryLegend`, sempre visivel).
 */
export interface BarChartProps {
  readonly data: readonly Record<string, number | string>[];
  readonly xKey: string;
  readonly series: readonly ChartSeriesConfig[];
  readonly height?: number;
  readonly width?: number;
}

export function BarChart({ data, xKey, series, height = 240, width }: BarChartProps): ReactNode {
  const theme = useTheme();
  const grid = theme.colors.borderDefault;
  const label = theme.colors.textSutil;
  const chartWidth = width ?? Dimensions.get('window').width - 32;

  return (
    <VictoryChart width={chartWidth} height={height} domainPadding={{ x: 24, y: 12 }}>
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
      <VictoryGroup offset={series.length > 1 ? 20 : 0}>
        {series.map((s, i) => (
          <VictoryBar
            key={s.key}
            data={[...data]}
            x={xKey}
            y={s.key}
            style={{ data: { fill: seriesColor(i) } }}
            cornerRadius={{ top: radius.sm }}
          />
        ))}
      </VictoryGroup>
      <VictoryLegend
        orientation="horizontal"
        gutter={16}
        style={{ labels: { fill: label, fontSize: 12 } }}
        data={series.map((s, i) => ({ name: s.label, symbol: { fill: seriesColor(i) } }))}
      />
    </VictoryChart>
  );
}

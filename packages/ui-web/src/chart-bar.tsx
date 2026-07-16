import type { ChartSeriesConfig } from '@fitvo/brand-tokens';
import { cssVarRef, radius, seriesColor } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Grafico de barra WEB (design-system-components.md §17). Mesmos tokens do
 * `chart-line` (grid/eixo via CSS var, ordem de cor das series). Diferenciador
 * alem da cor (§17): `Tooltip` sempre mostra o rotulo da serie por nome (nao so
 * a cor do swatch) — o padrao de traco do `chart-line` nao se aplica a barra
 * preenchida.
 */
export interface BarChartProps {
  readonly data: readonly Record<string, unknown>[];
  readonly xKey: string;
  readonly series: readonly ChartSeriesConfig[];
  readonly height?: number;
}

const grid = cssVarRef('borderDefault');
const label = cssVarRef('textSutil');

export function BarChart({ data, xKey, series, height = 280 }: BarChartProps): ReactNode {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={[...data]}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke={label}
          tick={{ fontSize: 12, fill: label }}
          tickLine={false}
          axisLine={{ stroke: grid }}
        />
        <YAxis
          stroke={label}
          tick={{ fontSize: 12, fill: label }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip cursor={{ fill: grid, fillOpacity: 0.4 }} />
        <Legend />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={seriesColor(i)}
            radius={[radius.sm, radius.sm, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

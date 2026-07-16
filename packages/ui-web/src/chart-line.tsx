import type { ChartSeriesConfig } from '@fitvo/brand-tokens';
import { cssVarRef, dashPattern, seriesColor } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Grafico de linha WEB (design-system-components.md §17). Wrapper fino sobre
 * Recharts: aplica a ordem de cor das series (`chartSeries`), grid/eixo
 * (`borderDefault`/`textSutil` — tokens, resolvidos via `var(--token)` para
 * seguir o tema pela cascata CSS, sem JS) e um padrao de traco por serie (§17:
 * cor nunca e o unico diferenciador). Nao cobre todo tipo de grafico da lib —
 * so os dois formatos previstos ate aqui (linha/barra); demais tipos ficam
 * para quando uma tela real pedir.
 */
export interface LineChartProps {
  readonly data: readonly Record<string, unknown>[];
  /** Chave do eixo X (categoria/tempo). */
  readonly xKey: string;
  readonly series: readonly ChartSeriesConfig[];
  readonly height?: number;
}

const grid = cssVarRef('borderDefault');
const label = cssVarRef('textSutil');

export function LineChart({ data, xKey, series, height = 280 }: LineChartProps): ReactNode {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={[...data]}>
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
        <Tooltip />
        <Legend />
        {series.map((s, i) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stroke={seriesColor(i)}
            strokeWidth={2}
            strokeDasharray={dashPattern(s, i)}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

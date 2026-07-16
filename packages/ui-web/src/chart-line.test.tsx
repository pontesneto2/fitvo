import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LineChart } from './chart-line';
import { mockChartLayout } from './chart-test-utils';

const DATA = [
  { month: 'Jan', treino: 12, nutricao: 8 },
  { month: 'Fev', treino: 18, nutricao: 10 },
];

const SERIES = [
  { key: 'treino', label: 'Treino' },
  { key: 'nutricao', label: 'Nutrição' },
];

beforeEach(() => {
  mockChartLayout();
});

describe('LineChart (web)', () => {
  it('renderiza sem lançar e monta a legenda com o nome de cada série', () => {
    render(<LineChart data={DATA} xKey="month" series={SERIES} height={200} />);
    expect(screen.getByText('Treino')).toBeTruthy();
    expect(screen.getByText('Nutrição')).toBeTruthy();
  });
});

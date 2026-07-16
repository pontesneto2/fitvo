import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BarChart } from './chart-bar';
import { mockChartLayout } from './chart-test-utils';

const DATA = [
  { month: 'Jan', receita: 4200 },
  { month: 'Fev', receita: 5100 },
];

const SERIES = [{ key: 'receita', label: 'Receita' }];

beforeEach(() => {
  mockChartLayout();
});

describe('BarChart (web)', () => {
  it('renderiza sem lançar e monta a legenda com o nome da série', () => {
    render(<BarChart data={DATA} xKey="month" series={SERIES} height={200} />);
    expect(screen.getByText('Receita')).toBeTruthy();
  });
});

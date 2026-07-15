import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TableColumn } from './table';
import { Pagination, Table } from './table';

interface Patient {
  readonly id: string;
  readonly name: string;
  readonly age: number;
}

const ROWS: Patient[] = [
  { id: '1', name: 'Ana Souza', age: 34 },
  { id: '2', name: 'Bruno Lima', age: 41 },
];

const COLUMNS: TableColumn<Patient>[] = [
  { key: 'name', header: 'Nome', sortable: true, cell: (r) => r.name },
  { key: 'age', header: 'Idade', align: 'right', cell: (r) => r.age },
];

describe('Table (web)', () => {
  it('renderiza cabecalho e celulas', () => {
    render(<Table columns={COLUMNS} rows={ROWS} getRowId={(r) => r.id} caption="Pacientes" />);
    expect(screen.getByRole('columnheader', { name: /Idade/ })).toBeTruthy();
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Pacientes' })).toBeTruthy();
  });

  it('coluna ordenavel: aria-sort reflete a ordenacao e o clique emite onSortChange', () => {
    const onSortChange = vi.fn();
    render(
      <Table
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(r) => r.id}
        sort={{ key: 'name', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    const nameHeader = screen.getByRole('columnheader', { name: /Nome/ });
    expect(nameHeader.getAttribute('aria-sort')).toBe('ascending');
    // coluna nao ordenada -> "none"
    expect(
      screen.getByRole('columnheader', { name: /Idade/ }).getAttribute('aria-sort'),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Nome/ }));
    expect(onSortChange).toHaveBeenCalledWith('name');
  });

  it('linha selecionada recebe aria-selected e fundo brand-50; clique dispara callback', () => {
    const onRowClick = vi.fn();
    render(
      <Table
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(r) => r.id}
        selectedId="2"
        onRowClick={onRowClick}
      />,
    );
    const selectedRow = screen.getByText('Bruno Lima').closest('tr') as HTMLElement;
    expect(selectedRow.getAttribute('aria-selected')).toBe('true');
    expect(selectedRow.className).toContain('bg-brand-50');
    fireEvent.click(screen.getByText('Ana Souza'));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });
});

describe('Pagination (web)', () => {
  it('nao renderiza com 1 pagina', () => {
    const { container } = render(<Pagination page={1} pageCount={1} onPageChange={() => {}} />);
    expect(container.querySelector('nav')).toBeNull();
  });

  it('marca a pagina atual com aria-current e destaca em brand-500', () => {
    render(<Pagination page={3} pageCount={10} onPageChange={() => {}} />);
    const current = screen.getByRole('button', { name: '3' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.className).toContain('bg-brand-500');
  });

  it('mostra reticencias em faixas longas e navega', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={5} pageCount={20} onPageChange={onPageChange} />);
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(onPageChange).toHaveBeenCalledWith(6);
  });

  it('desabilita anterior na primeira pagina', () => {
    render(<Pagination page={1} pageCount={5} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Página anterior' }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});

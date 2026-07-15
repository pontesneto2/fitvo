import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from './cn';
import { Icon } from './icon';

/**
 * Tabela WEB (design-system-components.md §16). Superficie de listagem dos paineis
 * admin/profissional. Generica por definicao de colunas (nao acopla dominio —
 * "nenhuma regra de negocio").
 *
 * Estados (§16): cabecalho `neutral-50` fundo + Inter 12/600 `fg-muted`; linha
 * normal `surface-raised` + borda-bottom 1px `neutral-100`; hover `neutral-50`;
 * selecionada `brand-50`; celula padding `space-3` + Inter 14/400 `fg`. Ordenacao
 * ativa: icone `brand-500` + `aria-sort`. Densidade `compact` (padrao admin, §0).
 *
 * Ordenacao CONTROLADA: o componente exibe o indicador/`aria-sort` e emite
 * `onSortChange(key)`; a ordenacao dos dados fica com o consumidor (apresentacional).
 *
 * Inferencia dark (§16/§21 nao especificam a tabela): superficies/bordas neutras
 * seguem a regra §21 "sobe na rampa" — cabecalho = superficie base (recessada:
 * `neutral-900`), linhas `surface-raised` (`neutral-800`), hover e separador
 * `neutral-700` (visiveis sobre as linhas); selecionada `brand-50` agnostica de
 * tema. Registrada.
 */
export type SortDirection = 'asc' | 'desc';
export type ColumnAlign = 'left' | 'right' | 'center';

export interface TableColumn<T> {
  readonly key: string;
  readonly header: ReactNode;
  readonly align?: ColumnAlign;
  readonly sortable?: boolean;
  readonly cell: (row: T) => ReactNode;
}

export interface TableSort {
  readonly key: string;
  readonly direction: SortDirection;
}

export interface TableProps<T> {
  readonly columns: readonly TableColumn<T>[];
  readonly rows: readonly T[];
  readonly getRowId: (row: T) => string;
  readonly caption?: string;
  readonly selectedId?: string;
  readonly onRowClick?: (row: T) => void;
  readonly sort?: TableSort;
  readonly onSortChange?: (key: string) => void;
  readonly density?: 'compact' | 'comfortable';
  readonly className?: string;
}

const alignClass: Record<ColumnAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

/**
 * Nao ordenado: `ChevronsUpDown` (indica coluna ordenavel). Ordenado: seta unica
 * na direcao ativa (`ArrowUp`/`ArrowDown`) — mais legivel que o par de chevrons
 * com opacidade do desenho original, mesma informacao (§16: icone `brand-500` +
 * `aria-sort` no cabecalho da coluna, ja aplicado pelo chamador).
 */
function SortIcon({
  active,
  direction,
}: {
  readonly active: boolean;
  readonly direction: SortDirection;
}): ReactNode {
  const glyph = !active ? ChevronsUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <Icon
      icon={glyph}
      size="sm"
      className={cn('ml-1 inline-block align-middle', active ? 'text-brand-500' : 'text-fg-subtle')}
    />
  );
}

export function Table<T>({
  columns,
  rows,
  getRowId,
  caption,
  selectedId,
  onRowClick,
  sort,
  onSortChange,
  density = 'compact',
  className,
}: TableProps<T>): ReactNode {
  const cellPad = density === 'compact' ? 'px-3 py-2' : 'px-3 py-3';

  const ariaSort = (key: string): 'ascending' | 'descending' | 'none' | undefined => {
    if (sort?.key !== key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse font-body text-small">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="bg-neutral-50 dark:bg-neutral-900">
            {columns.map((col): ReactNode => {
              const isSorted = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={col.sortable ? ariaSort(col.key) : undefined}
                  className={cn(
                    'text-caption font-semibold text-fg-muted',
                    cellPad,
                    alignClass[col.align ?? 'left'],
                  )}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(col.key)}
                      className={cn(
                        'inline-flex items-center rounded-sm font-semibold',
                        'transition-colors duration-fast ease-standard hover:text-fg',
                        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:ring-focus',
                      )}
                    >
                      {col.header}
                      <SortIcon active={isSorted} direction={sort?.direction ?? 'asc'} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row): ReactNode => {
            const id = getRowId(row);
            const selected = id === selectedId;
            return (
              <tr
                key={id}
                aria-selected={selected || undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-neutral-100 bg-surface-raised transition-colors duration-fast ease-standard dark:border-neutral-700',
                  selected && 'bg-brand-50',
                  onRowClick && 'cursor-pointer',
                  onRowClick && !selected && 'hover:bg-neutral-50 dark:hover:bg-neutral-700',
                )}
              >
                {columns.map((col): ReactNode => (
                  <td
                    key={col.key}
                    className={cn('text-fg', cellPad, alignClass[col.align ?? 'left'])}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Paginacao numerada (§16) ---

export interface PaginationProps {
  readonly page: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
  /** Quantos vizinhos mostrar em torno da pagina atual (padrao 1). */
  readonly siblingCount?: number;
  readonly 'aria-label'?: string;
  readonly className?: string;
}

/** Sequencia de paginas com reticencias (`-1` = elipse). */
function pageRange(page: number, pageCount: number, siblings: number): number[] {
  const range: number[] = [];
  const left = Math.max(2, page - siblings);
  const right = Math.min(pageCount - 1, page + siblings);
  range.push(1);
  if (left > 2) range.push(-1);
  for (let i = left; i <= right; i++) range.push(i);
  if (right < pageCount - 1) range.push(-1);
  if (pageCount > 1) range.push(pageCount);
  return range;
}

const pageBtn = cn(
  'flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-body text-small',
  'transition-colors duration-fast ease-standard',
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:ring-focus',
);

export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  'aria-label': ariaLabel = 'Paginação',
  className,
}: PaginationProps): ReactNode {
  if (pageCount <= 1) return null;
  const items = pageRange(page, pageCount, siblingCount);

  return (
    <nav aria-label={ariaLabel} className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
        className={cn(
          pageBtn,
          'text-fg-muted hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-fg-subtle disabled:hover:bg-transparent dark:hover:bg-neutral-800',
        )}
      >
        ‹
      </button>
      {items.map((n, i): ReactNode =>
        n === -1 ? (
          <span key={`gap-${i}`} className="px-1 text-fg-subtle" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            aria-current={n === page ? 'page' : undefined}
            className={cn(
              pageBtn,
              n === page
                ? 'bg-brand-500 font-medium text-white'
                : 'text-fg-muted hover:bg-neutral-100 dark:hover:bg-neutral-800',
            )}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Próxima página"
        className={cn(
          pageBtn,
          'text-fg-muted hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-fg-subtle disabled:hover:bg-transparent dark:hover:bg-neutral-800',
        )}
      >
        ›
      </button>
    </nav>
  );
}

import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from './cn';
import type { FieldStatus } from './field-styles';
import { fieldBase, fieldStatusClasses } from './field-styles';

/**
 * Select / Dropdown WEB (design-system-components.md §3 + dark §21). Primeiro
 * componente com OVERLAY e navegacao por teclado.
 *
 * - Trigger: segue as regras do Input (reusa `fieldBase`/`fieldStatusClasses` —
 *   todos os estados, foco, disabled), com raio `sm` como o campo. E um `button`
 *   com `aria-haspopup="listbox"`/`aria-expanded`.
 * - Menu: superficie `raised` (§3 = `surfaceRaised`: branco / `neutral-800`),
 *   borda `line`, raio `md`, sombra `raised`, entrada fade + slide 4px
 *   (`duration-fast`/`ease-out`, respeitando `prefers-reduced-motion`).
 * - Itens: normal / hover (mouse -> `neutral-100`) / foco de teclado e selecionado
 *   (`brand-50`+`brand-700`, com check `brand-500`) / disabled.
 * - A11y: `role="listbox"`/`option`, foco gerenciado no menu com
 *   `aria-activedescendant`, setas/Home/End/Enter/Esc/Tab + typeahead.
 *
 * Modo `searchable` (combobox — extensao do §3, nao um 2o componente): um campo de
 * busca no topo do menu filtra os itens por substring do rotulo. O campo vira o
 * `role="combobox"` (foco + `aria-activedescendant` migram para ele; a lista some do
 * fluxo de foco); sem resultado, mostra o estado vazio obrigatorio (§15). Busca nao
 * especificada no §3 -> UI construida so com tokens do sistema (campo transparente
 * `fg`/`line`, itens iguais aos do §3).
 *
 * Controlavel: usa `value` se dado, senao um estado interno. Integra com `Field`
 * (recebe `id`/`aria-describedby`/`status` via clone).
 *
 * Notas de inferencia (dark nao 100% fixado no doc): (1) §3 fixa o menu em
 * branco/`neutral-800` = token `surfaceRaised`; a tabela geral §21 lista "dropdown"
 * como `neutral-700`, mas a secao especifica do componente vence e casa com a
 * elevacao "raised" (media) que o §3 pede. (2) hover de item no dark sobe um stop
 * (`neutral-700`, regra §21). (3) sombra unica (light) como nos demais primitivos —
 * no dark a elevacao vem da superficie mais clara. Marca/perigo sao agnosticos.
 */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export type SelectStatus = FieldStatus;

export interface SelectProps {
  readonly options: readonly SelectOption[];
  /** Valor controlado. Se ausente, o componente controla o proprio estado. */
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  /** Texto exibido quando nada esta selecionado. */
  readonly placeholder?: string;
  /** Habilita o campo de busca no topo do menu (combobox). */
  readonly searchable?: boolean;
  /** Placeholder do campo de busca (quando `searchable`). */
  readonly searchPlaceholder?: string;
  /** Mensagem quando a busca nao retorna itens (estado vazio, §15). */
  readonly emptyLabel?: string;
  readonly status?: SelectStatus;
  readonly disabled?: boolean;
  /** Quando dado, emite um `<input type="hidden">` para envio em formularios. */
  readonly name?: string;
  readonly id?: string;
  readonly className?: string;
  readonly 'aria-describedby'?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
}

/** Primeiro item habilitado (ou -1). */
function firstEnabled(options: readonly SelectOption[]): number {
  return options.findIndex((o) => !o.disabled);
}

/** Ultimo item habilitado (ou -1). */
function lastEnabled(options: readonly SelectOption[]): number {
  for (let i = options.length - 1; i >= 0; i--) {
    if (!options[i]?.disabled) return i;
  }
  return -1;
}

/** Proximo item habilitado na direcao dada, sem dar a volta (clampa nas pontas). */
function nextEnabled(options: readonly SelectOption[], from: number, dir: 1 | -1): number {
  for (let i = from + dir; i >= 0 && i < options.length; i += dir) {
    if (!options[i]?.disabled) return i;
  }
  return from;
}

/** Item habilitado cujo rotulo comeca com `buffer` (typeahead), procurando a partir de `from`. */
function typeaheadIndex(options: readonly SelectOption[], buffer: string, from: number): number {
  const lower = buffer.toLowerCase();
  const n = options.length;
  for (let step = 0; step < n; step++) {
    const i = (from + step) % n;
    const o = options[i];
    if (o && !o.disabled && o.label.toLowerCase().startsWith(lower)) return i;
  }
  return -1;
}

/** Filtra por substring do rotulo (case-insensitive). Query vazia -> lista inteira. */
function filterOptions(options: readonly SelectOption[], query: string): readonly SelectOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.label.toLowerCase().includes(q));
}

function itemClasses(active: boolean, selected: boolean, disabled: boolean): string {
  if (disabled) return 'cursor-not-allowed text-fg-subtle';
  if (active || selected) return 'bg-brand-50 text-brand-700';
  return 'text-fg hover:bg-neutral-100 dark:hover:bg-neutral-700';
}

function ChevronIcon({ open }: { readonly open: boolean }): ReactNode {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn(
        'h-5 w-5 shrink-0 text-fg-muted transition-transform duration-fast ease-standard',
        open && 'rotate-180',
      )}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 8l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon(): ReactNode {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0 text-brand-500"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13 4.5 6.5 11 3 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon(): ReactNode {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0 text-fg-subtle"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Selecione…',
  searchable = false,
  searchPlaceholder = 'Buscar…',
  emptyLabel = 'Nenhum resultado',
  status = 'default',
  disabled = false,
  name,
  id,
  className,
  'aria-describedby': ariaDescribedby,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: SelectProps): ReactNode {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const selected = isControlled ? value : internal;

  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState('');

  const autoId = useId();
  const rootId = id ?? autoId;
  const listboxId = `${rootId}-listbox`;
  const optionId = (i: number): string => `${rootId}-opt-${i}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeahead = useRef<{ buffer: string; timer: number | undefined }>({
    buffer: '',
    timer: undefined,
  });

  // Itens visiveis: filtrados pela busca quando `searchable`; senao, todos.
  const visible = searchable ? filterOptions(options, query) : options;

  // Rotulo do trigger vem de TODAS as opcoes (o selecionado pode estar filtrado fora).
  const selectedOption = options.find((o) => o.value === selected);
  const selectedVisibleIndex = visible.findIndex((o) => o.value === selected);

  const openMenu = (): void => {
    if (disabled) return;
    setActiveIndex(selectedVisibleIndex >= 0 ? selectedVisibleIndex : firstEnabled(visible));
    setOpen(true);
  };

  const closeMenu = (focusTrigger: boolean): void => {
    setOpen(false);
    setQuery('');
    if (focusTrigger) buttonRef.current?.focus();
  };

  const choose = (i: number): void => {
    const o = visible[i];
    if (!o || o.disabled) return;
    if (!isControlled) setInternal(o.value);
    onValueChange?.(o.value);
    closeMenu(true);
  };

  // Entrada animada + foco no menu ao abrir (campo de busca ou a propria lista).
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    if (searchable) searchRef.current?.focus();
    else listRef.current?.focus();
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open, searchable]);

  // Fecha ao clicar fora (sem roubar foco de volta ao trigger).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const runTypeahead = (char: string): void => {
    const t = typeahead.current;
    if (t.timer !== undefined) clearTimeout(t.timer);
    t.buffer += char;
    const from =
      activeIndex >= 0 ? activeIndex : selectedVisibleIndex >= 0 ? selectedVisibleIndex : 0;
    const idx = typeaheadIndex(visible, t.buffer, from);
    if (idx >= 0) setActiveIndex(idx);
    t.timer = window.setTimeout(() => {
      t.buffer = '';
    }, 500);
  };

  const onQueryChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value;
    setQuery(next);
    setActiveIndex(firstEnabled(filterOptions(options, next)));
  };

  /** Navegacao por teclado. `typing=true` no campo de busca: espaco/letras digitam. */
  const handleNav = (e: KeyboardEvent<HTMLElement>, typing: boolean): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => nextEnabled(visible, i, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => nextEnabled(visible, i, -1));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(firstEnabled(visible));
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(lastEnabled(visible));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0) choose(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        closeMenu(true);
        break;
      case 'Tab':
        closeMenu(false);
        break;
      case ' ':
        if (!typing) {
          e.preventDefault();
          if (activeIndex >= 0) choose(activeIndex);
        }
        break;
      default:
        if (!typing && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          runTypeahead(e.key);
        }
    }
  };

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
  };

  const activeDescendant =
    activeIndex >= 0 && visible.length > 0 ? optionId(activeIndex) : undefined;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        id={rootId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
        className={cn(
          fieldBase,
          'flex h-md items-center justify-between gap-2 text-left',
          fieldStatusClasses[status],
        )}
      >
        <span className={cn('truncate', selectedOption ? 'text-fg' : 'text-fg-subtle')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronIcon open={open} />
      </button>

      {name ? <input type="hidden" name={name} value={selected ?? ''} /> : null}

      {open ? (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 mt-1 rounded-md border border-line bg-surface-raised p-1 shadow-raised',
            'transition duration-fast ease-out motion-reduce:transition-none',
            entered ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
          )}
        >
          {searchable ? (
            <div className="mb-1 flex items-center gap-2 border-b border-line px-2 pb-1.5">
              <SearchIcon />
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-expanded
                aria-controls={listboxId}
                aria-activedescendant={activeDescendant}
                aria-autocomplete="list"
                aria-label={ariaLabel ?? searchPlaceholder}
                value={query}
                placeholder={searchPlaceholder}
                onChange={onQueryChange}
                onKeyDown={(e) => handleNav(e, true)}
                className="w-full bg-transparent text-small text-fg placeholder:text-fg-subtle focus:outline-none"
              />
            </div>
          ) : null}

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={searchable ? undefined : -1}
            aria-activedescendant={searchable ? undefined : activeDescendant}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledby}
            onKeyDown={searchable ? undefined : (e) => handleNav(e, false)}
            className="max-h-60 overflow-auto focus:outline-none"
          >
            {visible.length === 0 ? (
              <li role="presentation" className="px-3 py-2 text-small text-fg-subtle">
                {emptyLabel}
              </li>
            ) : (
              visible.map((o, i): ReactNode => {
                const isSelected = o.value === selected;
                const isActive = i === activeIndex;
                return (
                  <li
                    key={o.value}
                    id={optionId(i)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={o.disabled || undefined}
                    onClick={() => choose(i)}
                    className={cn(
                      'flex select-none items-center justify-between gap-2 rounded-sm px-3 py-2 text-small',
                      o.disabled ? '' : 'cursor-pointer',
                      itemClasses(isActive, isSelected, o.disabled ?? false),
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSelected ? <CheckIcon /> : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

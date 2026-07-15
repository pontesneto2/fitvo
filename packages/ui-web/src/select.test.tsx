import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SelectOption } from './select';
import { Select } from './select';

const OPTIONS: SelectOption[] = [
  { value: 'a', label: 'Abacaxi' },
  { value: 'b', label: 'Banana', disabled: true },
  { value: 'c', label: 'Cereja' },
  { value: 'd', label: 'Damasco' },
];

/** Rotulo do item atualmente apontado por `aria-activedescendant` (foco gerenciado). */
function activeLabel(): string | null {
  const lb = screen.getByRole('listbox');
  const id = lb.getAttribute('aria-activedescendant');
  return id ? (document.getElementById(id)?.textContent ?? null) : null;
}

describe('Select (web)', () => {
  it('fechado: mostra placeholder, role button e aria-expanded=false', () => {
    render(<Select options={OPTIONS} placeholder="Escolha uma fruta" aria-label="Fruta" />);
    const trigger = screen.getByRole('button', { name: 'Fruta' });
    expect(trigger.textContent).toContain('Escolha uma fruta');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clique abre o menu com uma option por item', () => {
    render(<Select options={OPTIONS} aria-label="Fruta" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });

  it('abre com o primeiro item habilitado ativo', () => {
    render(<Select options={OPTIONS} aria-label="Fruta" />);
    fireEvent.click(screen.getByRole('button'));
    expect(activeLabel()).toBe('Abacaxi');
  });

  it('nao-controlado: clicar num item seleciona, fecha e reflete no trigger', () => {
    const onValueChange = vi.fn();
    render(<Select options={OPTIONS} aria-label="Fruta" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'Cereja' }));
    expect(onValueChange).toHaveBeenCalledWith('c');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('button').textContent).toContain('Cereja');
  });

  it('teclado: ArrowDown pula o item disabled e Enter seleciona o ativo', () => {
    const onValueChange = vi.fn();
    render(<Select options={OPTIONS} aria-label="Fruta" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button'));
    const lb = screen.getByRole('listbox');
    // Ativo em Abacaxi (0); Banana (1) esta disabled -> pula para Cereja (2).
    fireEvent.keyDown(lb, { key: 'ArrowDown' });
    expect(activeLabel()).toBe('Cereja');
    fireEvent.keyDown(lb, { key: 'Enter' });
    expect(onValueChange).toHaveBeenCalledWith('c');
  });

  it('typeahead: digitar aponta para o item cujo rotulo comeca com a tecla', () => {
    render(<Select options={OPTIONS} aria-label="Fruta" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'd' });
    expect(activeLabel()).toBe('Damasco');
  });

  it('Escape fecha o menu', () => {
    render(<Select options={OPTIONS} aria-label="Fruta" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });

  it('item disabled: marcado com aria-disabled e nao seleciona ao clicar', () => {
    const onValueChange = vi.fn();
    render(<Select options={OPTIONS} aria-label="Fruta" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button'));
    const banana = screen.getByRole('option', { name: 'Banana' });
    expect(banana.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(banana);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('controlado: reflete a prop `value` e nao muda sozinho', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Select options={OPTIONS} aria-label="Fruta" value="a" onValueChange={onValueChange} />,
    );
    expect(screen.getByRole('button').textContent).toContain('Abacaxi');
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'Damasco' }));
    expect(onValueChange).toHaveBeenCalledWith('d');
    // Sem rerender, o valor controlado nao mudou.
    expect(screen.getByRole('button').textContent).toContain('Abacaxi');
    rerender(
      <Select options={OPTIONS} aria-label="Fruta" value="d" onValueChange={onValueChange} />,
    );
    expect(screen.getByRole('button').textContent).toContain('Damasco');
  });

  it('selecionado: a option marca aria-selected=true', () => {
    render(<Select options={OPTIONS} aria-label="Fruta" value="c" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('option', { name: 'Cereja' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });
});

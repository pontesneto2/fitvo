import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Tabs } from './tabs';

const ITEMS = [
  { value: 'a', label: 'Visão geral' },
  { value: 'b', label: 'Treinos' },
  { value: 'c', label: 'Bloqueada', disabled: true },
  { value: 'd', label: 'Financeiro' },
];

describe('Tabs (web)', () => {
  it('renderiza role=tablist/tab e marca a primeira como selecionada por padrao', () => {
    render(<Tabs items={ITEMS} aria-label="Seções" />);
    expect(screen.getByRole('tablist', { name: 'Seções' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Visão geral' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('clique seleciona e dispara onValueChange', () => {
    const onValueChange = vi.fn();
    render(<Tabs items={ITEMS} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Treinos' }));
    expect(onValueChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('tab', { name: 'Treinos' }).getAttribute('aria-selected')).toBe('true');
  });

  it('roving tabindex: so a aba ativa tem tabindex 0', () => {
    render(<Tabs items={ITEMS} defaultValue="d" />);
    expect(screen.getByRole('tab', { name: 'Financeiro' }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: 'Visão geral' }).getAttribute('tabindex')).toBe('-1');
  });

  it('Seta direita ativa a proxima habilitada, pulando a desabilitada', () => {
    render(<Tabs items={ITEMS} defaultValue="b" />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Treinos' }), { key: 'ArrowRight' });
    // pula "Bloqueada" (disabled) -> "Financeiro"
    expect(screen.getByRole('tab', { name: 'Financeiro' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('acento de ambiente troca a cor do texto ativo (lime p/ treino)', () => {
    render(<Tabs items={ITEMS} accent="training" defaultValue="a" />);
    expect(screen.getByRole('tab', { name: 'Visão geral' }).className).toContain('text-lime-700');
  });

  it('aba desabilitada nao seleciona no clique', () => {
    const onValueChange = vi.fn();
    render(<Tabs items={ITEMS} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Bloqueada' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

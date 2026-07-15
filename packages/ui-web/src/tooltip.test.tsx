import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Tooltip } from './tooltip';

afterEach(() => {
  vi.useRealTimers();
});

function setup(): HTMLElement {
  render(
    <Tooltip content="Ajuda contextual">
      <button type="button">Info</button>
    </Tooltip>,
  );
  return screen.getByRole('button', { name: 'Info' });
}

describe('Tooltip (web)', () => {
  it('nao aparece antes do delay de 400ms; aparece depois (hover)', () => {
    vi.useFakeTimers();
    const trigger = setup();
    const wrapper = trigger.parentElement as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByRole('tooltip').textContent).toBe('Ajuda contextual');
  });

  it('gatilho recebe aria-describedby enquanto visivel', () => {
    vi.useFakeTimers();
    const trigger = setup();
    const wrapper = trigger.parentElement as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const tip = screen.getByRole('tooltip');
    expect(trigger.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('fecha em 100ms ao sair (mouseLeave)', () => {
    vi.useFakeTimers();
    const trigger = setup();
    const wrapper = trigger.parentElement as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.mouseLeave(wrapper);
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('abre no foco do gatilho (teclado)', () => {
    vi.useFakeTimers();
    const trigger = setup();
    fireEvent.focus(trigger);
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('Esc fecha imediatamente', () => {
    vi.useFakeTimers();
    const trigger = setup();
    const wrapper = trigger.parentElement as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    act(() => vi.advanceTimersByTime(400));
    fireEvent.keyDown(wrapper, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('usa os tokens semanticos de tooltip (invertem por tema)', () => {
    vi.useFakeTimers();
    const trigger = setup();
    fireEvent.focus(trigger);
    act(() => vi.advanceTimersByTime(400));
    const cls = screen.getByRole('tooltip').className;
    expect(cls).toContain('bg-tooltip');
    expect(cls).toContain('text-tooltip-fg');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from './switch';

describe('Switch (web)', () => {
  it('renderiza com role switch e rotulo', () => {
    render(<Switch>Notificacoes</Switch>);
    expect(screen.getByRole('switch', { name: 'Notificacoes' })).toBeTruthy();
  });

  it('nao-controlado: o clique alterna', () => {
    render(<Switch>x</Switch>);
    const sw = screen.getByRole('switch') as HTMLInputElement;
    expect(sw.checked).toBe(false);
    fireEvent.click(sw);
    expect(sw.checked).toBe(true);
  });

  it('controlado: dispara onChange e reflete a prop', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Switch checked={false} onChange={onChange}>
        x
      </Switch>,
    );
    const sw = screen.getByRole('switch') as HTMLInputElement;
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(sw.checked).toBe(false);
    rerender(
      <Switch checked onChange={onChange}>
        x
      </Switch>,
    );
    expect(sw.checked).toBe(true);
  });

  it('disabled: marca o input como desabilitado', () => {
    render(<Switch disabled>x</Switch>);
    expect((screen.getByRole('switch') as HTMLInputElement).disabled).toBe(true);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox';

describe('Checkbox (web)', () => {
  it('renderiza rotulo e role checkbox', () => {
    render(<Checkbox>Aceito os termos</Checkbox>);
    expect(screen.getByRole('checkbox', { name: 'Aceito os termos' })).toBeTruthy();
  });

  it('nao-controlado: o clique alterna o estado', () => {
    render(<Checkbox>x</Checkbox>);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(box.checked).toBe(true);
  });

  it('controlado: dispara onChange e reflete a prop', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Checkbox checked={false} onChange={onChange}>
        x
      </Checkbox>,
    );
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(box.checked).toBe(false); // so muda se a prop mudar
    rerender(
      <Checkbox checked onChange={onChange}>
        x
      </Checkbox>,
    );
    expect(box.checked).toBe(true);
  });

  it('disabled: marca o input como desabilitado', () => {
    // O bloqueio de toque e do browser; testamos o que controlamos (o atributo).
    render(<Checkbox disabled>x</Checkbox>);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('indeterminate: seta a propriedade DOM', () => {
    render(<Checkbox indeterminate>x</Checkbox>);
    expect((screen.getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(true);
  });

  it('error: marca aria-invalid', () => {
    render(<Checkbox error>x</Checkbox>);
    expect(screen.getByRole('checkbox').getAttribute('aria-invalid')).toBe('true');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Radio } from './radio';

describe('Radio (web)', () => {
  it('renderiza rotulo e role radio', () => {
    render(<Radio>Mensal</Radio>);
    expect(screen.getByRole('radio', { name: 'Mensal' })).toBeTruthy();
  });

  it('nao-controlado: o clique seleciona', () => {
    render(<Radio>x</Radio>);
    const el = screen.getByRole('radio') as HTMLInputElement;
    fireEvent.click(el);
    expect(el.checked).toBe(true);
  });

  it('controlado: dispara onChange', () => {
    const onChange = vi.fn();
    render(
      <Radio checked={false} onChange={onChange}>
        x
      </Radio>,
    );
    fireEvent.click(screen.getByRole('radio'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('grupo por name: so um fica selecionado', () => {
    render(
      <>
        <Radio name="plano" value="m">
          Mensal
        </Radio>
        <Radio name="plano" value="a">
          Anual
        </Radio>
      </>,
    );
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const mensal = radios[0]!;
    const anual = radios[1]!;
    fireEvent.click(mensal);
    expect(mensal.checked).toBe(true);
    fireEvent.click(anual);
    expect(anual.checked).toBe(true);
    expect(mensal.checked).toBe(false);
  });

  it('disabled: marca o input como desabilitado', () => {
    render(<Radio disabled>x</Radio>);
    expect((screen.getByRole('radio') as HTMLInputElement).disabled).toBe(true);
  });
});

import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Checkbox } from './checkbox';
import { Input } from './input';
import { Radio } from './radio';
import { Select } from './select';
import { Switch } from './switch';
import { Textarea } from './textarea';

/**
 * REPROVA se o controle nao encaminhar o `ref` ao elemento DOM real. Um teste que
 * so renderiza passaria IDENTICO sem `forwardRef` — por isso a assercao e sobre
 * `ref.current` apontar para o no nativo. Sem `forwardRef`, `ref.current` fica
 * `null` e o `toBeInstanceOf` falha. E o que habilita o `register()` uncontrolled
 * do React Hook Form (ADR-0005).
 */
describe('forwardRef dos controles (web)', () => {
  it('Input encaminha o ref para o <input>', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('Textarea encaminha o ref para o <textarea>', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('Checkbox encaminha o ref para o <input>, mantendo o ref interno de indeterminate', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox ref={ref} indeterminate />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.type).toBe('checkbox');
    // prova que fundir o ref encaminhado nao quebrou o ref interno (indeterminate):
    expect(ref.current?.indeterminate).toBe(true);
  });

  it('Radio encaminha o ref para o <input type=radio>', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Radio ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.type).toBe('radio');
  });

  it('Switch encaminha o ref para o <input role=switch>', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Switch ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.getAttribute('role')).toBe('switch');
  });

  it('Select encaminha o ref para o botao-gatilho (combobox custom; mantem o ref interno)', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Select options={[{ value: 'a', label: 'A' }]} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

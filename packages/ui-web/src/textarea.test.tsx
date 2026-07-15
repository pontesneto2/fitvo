import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Textarea } from './textarea';

describe('Textarea (web)', () => {
  it('renderiza multilinha com altura minima e dispara onChange', () => {
    const onChange = vi.fn();
    render(<Textarea placeholder="Observacoes" onChange={onChange} />);
    const el = screen.getByPlaceholderText('Observacoes');
    expect(el.tagName).toBe('TEXTAREA');
    expect(el.className).toContain('min-h-[80px]');
    fireEvent.change(el, { target: { value: 'oi' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('status=error: aria-invalid e borda de perigo', () => {
    render(<Textarea placeholder="x" status="error" />);
    const el = screen.getByPlaceholderText('x');
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(el.className).toContain('border-danger-400');
  });

  it('disabled bloqueia edicao', () => {
    render(<Textarea placeholder="x" disabled />);
    expect((screen.getByPlaceholderText('x') as HTMLTextAreaElement).disabled).toBe(true);
  });
});

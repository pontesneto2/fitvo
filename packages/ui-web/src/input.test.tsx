import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Input } from './input';

describe('Input (web)', () => {
  it('renderiza e dispara onChange ao digitar', () => {
    const onChange = vi.fn();
    render(<Input placeholder="E-mail" onChange={onChange} />);
    const el = screen.getByPlaceholderText('E-mail');
    fireEvent.change(el, { target: { value: 'a@b.com' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('default: sem aria-invalid, fundo e borda neutros', () => {
    render(<Input placeholder="x" />);
    const el = screen.getByPlaceholderText('x');
    expect(el.getAttribute('aria-invalid')).toBeNull();
    expect(el.className).toContain('border-line');
    expect(el.className).toContain('bg-neutral-50');
  });

  it('status=error: aria-invalid e cor de perigo', () => {
    render(<Input placeholder="x" status="error" />);
    const el = screen.getByPlaceholderText('x');
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(el.className).toContain('border-danger-400');
    expect(el.className).toContain('bg-danger-50');
  });

  it('status=success: cor de sucesso, sem aria-invalid', () => {
    render(<Input placeholder="x" status="success" />);
    const el = screen.getByPlaceholderText('x');
    expect(el.getAttribute('aria-invalid')).toBeNull();
    expect(el.className).toContain('border-energy-500');
  });

  it('disabled bloqueia edicao', () => {
    render(<Input placeholder="x" disabled />);
    const el = screen.getByPlaceholderText('x') as HTMLInputElement;
    expect(el.disabled).toBe(true);
  });

  it('placeholder usa o token sutil', () => {
    render(<Input placeholder="x" />);
    expect(screen.getByPlaceholderText('x').className).toContain('placeholder:text-fg-subtle');
  });
});

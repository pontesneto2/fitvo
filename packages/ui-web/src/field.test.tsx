import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Field } from './field';
import { Input } from './input';

describe('Field (web)', () => {
  it('associa o rotulo ao controle (htmlFor = id gerado)', () => {
    render(
      <Field label="E-mail">
        <Input placeholder="voce@ex.com" />
      </Field>,
    );
    const input = screen.getByPlaceholderText('voce@ex.com');
    const label = screen.getByText('E-mail');
    expect(input.id).toBeTruthy();
    expect(label.getAttribute('for')).toBe(input.id);
  });

  it('ajuda: mostra e liga via aria-describedby', () => {
    render(
      <Field label="E-mail" description="Enviaremos o comprovante.">
        <Input placeholder="x" />
      </Field>,
    );
    const input = screen.getByPlaceholderText('x');
    const help = screen.getByText('Enviaremos o comprovante.');
    expect(input.getAttribute('aria-describedby')).toBe(help.id);
  });

  it('erro: injeta status/aria-invalid no controle e esconde a ajuda', () => {
    render(
      <Field label="Senha" description="Dica que some" error="Minimo de 8 caracteres.">
        <Input placeholder="x" />
      </Field>,
    );
    const input = screen.getByPlaceholderText('x');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.className).toContain('border-danger-400'); // status=error injetado
    const err = screen.getByText('Minimo de 8 caracteres.');
    expect(input.getAttribute('aria-describedby')).toBe(err.id);
    expect(screen.queryByText('Dica que some')).toBeNull();
  });

  it('required: marca asterisco', () => {
    render(
      <Field label="Nome" required>
        <Input placeholder="x" />
      </Field>,
    );
    expect(screen.getByText('*')).toBeTruthy();
  });
});

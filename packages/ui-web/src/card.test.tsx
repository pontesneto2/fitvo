import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Card } from './card';

describe('Card (web)', () => {
  it('renderiza os filhos', () => {
    render(<Card>Conteudo do card</Card>);
    expect(screen.getByText('Conteudo do card')).toBeTruthy();
  });

  it('default: nao e focavel nem tem role', () => {
    render(<Card>estatico</Card>);
    const el = screen.getByText('estatico');
    expect(el.getAttribute('tabindex')).toBeNull();
    expect(el.getAttribute('role')).toBeNull();
  });

  it('interativo com onClick: vira role=button, focavel e ativa por Enter/Espaco', () => {
    const onClick = vi.fn();
    render(
      <Card variant="interactive" onClick={onClick}>
        Abrir plano
      </Card>,
    );
    const el = screen.getByRole('button', { name: 'Abrir plano' });
    expect(el.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.keyDown(el, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('interativo: clique dispara onClick', () => {
    const onClick = vi.fn();
    render(
      <Card variant="interactive" onClick={onClick}>
        clicavel
      </Card>,
    );
    fireEvent.click(screen.getByText('clicavel'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('interativo sem onClick: focavel, mas sem role button', () => {
    render(<Card variant="interactive">so foco</Card>);
    const el = screen.getByText('so foco');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('role')).toBeNull();
  });

  it('respeita role e tabIndex informados pelo consumidor', () => {
    render(
      <Card variant="interactive" role="link" tabIndex={-1}>
        custom
      </Card>,
    );
    const el = screen.getByText('custom');
    expect(el.getAttribute('role')).toBe('link');
    expect(el.getAttribute('tabindex')).toBe('-1');
  });
});

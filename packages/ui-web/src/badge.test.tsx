import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Badge } from './badge';

describe('Badge (web)', () => {
  it('renderiza o rotulo', () => {
    render(<Badge>Ativo</Badge>);
    expect(screen.getByText('Ativo')).toBeTruthy();
  });

  it('neutral (padrao): fundo neutral-100 + texto semantico, adapta no dark', () => {
    render(<Badge>n</Badge>);
    const cls = screen.getByText('n').className;
    expect(cls).toContain('bg-neutral-100');
    expect(cls).toContain('text-fg-muted');
    expect(cls).toContain('dark:bg-neutral-700');
  });

  it('variantes de acento usam o tom da rampa (agnostico de tema)', () => {
    render(
      <Badge variant="training" data-testid="b">
        treino
      </Badge>,
    );
    const cls = screen.getByTestId('b').className;
    expect(cls).toContain('bg-lime-50');
    expect(cls).toContain('text-lime-800');
  });

  it('removivel: expoe botao com aria-label e dispara onRemove', () => {
    const onRemove = vi.fn();
    render(
      <Badge variant="brand" removable onRemove={onRemove}>
        tag
      </Badge>,
    );
    const btn = screen.getByRole('button', { name: 'Remover' });
    expect(btn.className).toContain('hover:bg-brand-200');
    fireEvent.click(btn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('sem `removable`: nao renderiza botao', () => {
    render(<Badge>simples</Badge>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

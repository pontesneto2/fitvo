import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';
import { EmptyState, ErrorState, Skeleton } from './states';

describe('Skeleton (web)', () => {
  it('e decorativo (aria-hidden) e pulsa sobre neutral-200', () => {
    const { container } = render(<Skeleton width={120} height={16} />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('bg-neutral-200');
    expect(el.style.width).toBe('120px');
  });

  it('variante text/circle mudam o formato', () => {
    const { container: text } = render(<Skeleton variant="text" />);
    expect((text.firstChild as HTMLElement).className).toContain('rounded-sm');
    const { container: circle } = render(<Skeleton variant="circle" width={40} height={40} />);
    expect((circle.firstChild as HTMLElement).className).toContain('rounded-full');
  });
});

describe('EmptyState (web)', () => {
  it('mostra titulo, descricao e acao', () => {
    render(
      <EmptyState
        title="Nenhum paciente"
        description="Adicione o primeiro para começar."
        action={<Button>Adicionar</Button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Nenhum paciente' })).toBeTruthy();
    expect(screen.getByText('Adicione o primeiro para começar.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeTruthy();
  });
});

describe('ErrorState (web)', () => {
  it('usa role=alert, titulo/mensagem amigaveis padrao e botao de retry', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Algo deu errado' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('sem onRetry: nao renderiza botao', () => {
    render(<ErrorState message="Falha de rede." />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Falha de rede.')).toBeTruthy();
  });
});

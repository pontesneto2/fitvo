import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ToastData } from './toast';
import { Toast, ToastProvider, useToast } from './toast';

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast (web) — presentacional', () => {
  it('success usa role=status e a superficie energy', () => {
    render(<Toast variant="success" title="Salvo" description="Plano atualizado" />);
    const el = screen.getByRole('status');
    expect(el.className).toContain('bg-energy-50');
    expect(el.className).toContain('border-l-energy-500');
    expect(screen.getByText('Salvo')).toBeTruthy();
    expect(screen.getByText('Plano atualizado')).toBeTruthy();
  });

  it('error usa role=alert (assertivo)', () => {
    render(<Toast variant="error" title="Falhou" />);
    const el = screen.getByRole('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
  });

  it('titulo/descricao fixam tons escuros (agnostico de tema)', () => {
    render(<Toast variant="info" title="Aviso" description="detalhe" />);
    expect(screen.getByText('Aviso').className).toContain('text-neutral-900');
    expect(screen.getByText('detalhe').className).toContain('text-neutral-600');
  });

  it('botao fechar dispara onClose', () => {
    const onClose = vi.fn();
    render(<Toast variant="info" title="X" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function Pusher({ opts }: { readonly opts: Omit<ToastData, 'id'> }): ReactNode {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast(opts)}>
      push
    </button>
  );
}

describe('ToastProvider / useToast — fila', () => {
  it('empurra e exibe um toast; fechar remove', () => {
    render(
      <ToastProvider>
        <Pusher opts={{ variant: 'success', title: 'Feito' }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'push' }));
    expect(screen.getByText('Feito')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByText('Feito')).toBeNull();
  });

  it('auto-dismiss em 5s para variantes nao-erro', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Pusher opts={{ variant: 'info', title: 'Some em 5s' }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'push' }));
    expect(screen.getByText('Some em 5s')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Some em 5s')).toBeNull();
  });

  it('erro NAO fecha sozinho (fica ate acao do usuario)', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Pusher opts={{ variant: 'error', title: 'Erro fixo' }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'push' }));
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText('Erro fixo')).toBeTruthy();
  });

  it('useToast fora do provider lanca', () => {
    expect(() => render(<Pusher opts={{ title: 'x' }} />)).toThrow(/ToastProvider/);
  });
});

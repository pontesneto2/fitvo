import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button (web)', () => {
  it('renderiza o rotulo e e do tipo button por padrao', () => {
    render(<Button>Agendar</Button>);
    const btn = screen.getByRole('button', { name: 'Agendar' });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('dispara onClick quando habilitado', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ok</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled bloqueia o clique', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Ok
      </Button>,
    );
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading: seta aria-busy, desabilita e nao clica', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Salvando
      </Button>,
    );
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('aplica classes de token por variante e tamanho', () => {
    render(
      <Button variant="destructive" size="lg">
        Excluir
      </Button>,
    );
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('bg-danger-400'); // variante
    expect(cls).toContain('h-lg'); // tamanho
    expect(cls).toContain('ring-danger-200'); // anel especifico do destrutivo
  });

  it('primary usa o anel de foco semantico (ring-focus)', () => {
    render(<Button>Primario</Button>);
    expect(screen.getByRole('button').className).toContain('focus-visible:ring-focus');
  });

  it('repassa className extra sem perder as classes base', () => {
    render(<Button className="w-full">Full</Button>);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('w-full');
    expect(cls).toContain('rounded-md');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SideNav } from './side-nav';

const ITEMS = [
  { value: 'home', label: 'Início', href: '/inicio' },
  { value: 'agenda', label: 'Agenda', href: '/agenda' },
  { value: 'fin', label: 'Financeiro' },
  { value: 'admin', label: 'Admin', disabled: true },
];

/** O modo rail so vale para item COM icone — ver `collapsed` no SideNav. */
const ICON_ITEMS = [
  { value: 'home', label: 'Início', href: '/inicio', icon: <svg aria-hidden="true" /> },
  { value: 'agenda', label: 'Agenda', href: '/agenda', icon: <svg aria-hidden="true" /> },
];

describe('SideNav (web)', () => {
  it('renderiza um nav rotulado com os itens', () => {
    render(<SideNav items={ITEMS} aria-label="Principal" defaultValue="home" />);
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeTruthy();
    expect(screen.getByText('Agenda')).toBeTruthy();
  });

  it('item com href vira link; ativo recebe aria-current=page e fundo brand-50', () => {
    render(<SideNav items={ITEMS} defaultValue="agenda" />);
    const link = screen.getByRole('link', { name: 'Agenda' });
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.className).toContain('bg-brand-50');
  });

  it('item sem href vira button e seleciona no clique', () => {
    const onValueChange = vi.fn();
    render(<SideNav items={ITEMS} defaultValue="home" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Financeiro' }));
    expect(onValueChange).toHaveBeenCalledWith('fin');
    expect(screen.getByRole('button', { name: 'Financeiro' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('item desabilitado nao dispara selecao', () => {
    const onValueChange = vi.fn();
    render(<SideNav items={ITEMS} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('collapsed esconde o rotulo VISUALMENTE mas o mantem acessivel', () => {
    render(<SideNav items={ICON_ITEMS} collapsed defaultValue="home" />);
    // O item continua alcancavel pelo nome — o rail nao pode custar o leitor de tela.
    const link = screen.getByRole('link', { name: 'Início' });
    expect(link.className).toContain('justify-center');
    expect(screen.getByText('Início').className).toContain('sr-only');
  });

  it('collapsed NAO esconde o rotulo de item sem icone (alvo ficaria em branco)', () => {
    render(<SideNav items={ITEMS} collapsed defaultValue="home" />);
    expect(screen.getByText('Início').className).toContain('truncate');
  });

  it('sem collapsed o rotulo permanece visivel mesmo com icone', () => {
    render(<SideNav items={ICON_ITEMS} defaultValue="home" />);
    expect(screen.getByText('Início').className).toContain('truncate');
  });

  it('estado normal usa fg-muted; hover sobe superficie neutra no dark', () => {
    render(<SideNav items={ITEMS} defaultValue="agenda" />);
    const cls = screen.getByRole('button', { name: 'Financeiro' }).className;
    expect(cls).toContain('text-fg-muted');
    expect(cls).toContain('dark:hover:bg-neutral-800');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Breadcrumb } from './breadcrumb';

const ITEMS = [
  { label: 'Início', href: '/' },
  { label: 'Pacientes', href: '/pacientes' },
  { label: 'Ana Souza' },
];

describe('Breadcrumb (web)', () => {
  it('renderiza um nav rotulado', () => {
    render(<Breadcrumb items={ITEMS} />);
    expect(screen.getByRole('navigation', { name: 'Trilha de navegação' })).toBeTruthy();
  });

  it('itens intermediarios com href sao links', () => {
    render(<Breadcrumb items={ITEMS} />);
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Pacientes' })).toBeTruthy();
  });

  it('ultimo item e o atual (aria-current=page), sem link e peso 500', () => {
    render(<Breadcrumb items={ITEMS} />);
    expect(screen.queryByRole('link', { name: 'Ana Souza' })).toBeNull();
    const current = screen.getByText('Ana Souza');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.className).toContain('font-medium');
    expect(current.className).toContain('text-fg');
  });

  it('separadores / sao aria-hidden (um a menos que os itens)', () => {
    const { container } = render(<Breadcrumb items={ITEMS} />);
    const seps = container.querySelectorAll('[aria-hidden="true"]');
    expect(seps.length).toBe(ITEMS.length - 1);
  });

  it('link normal usa fg-muted e hover brand-600', () => {
    render(<Breadcrumb items={ITEMS} />);
    const cls = screen.getByRole('link', { name: 'Pacientes' }).className;
    expect(cls).toContain('text-fg-muted');
    expect(cls).toContain('hover:text-brand-600');
  });
});

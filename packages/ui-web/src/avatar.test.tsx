import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar, AvatarGroup, getInitials } from './avatar';

describe('getInitials', () => {
  it('deriva 1a+ultima palavra (ate 2), maiuscula', () => {
    expect(getInitials('Ana Souza')).toBe('AS');
    expect(getInitials('Ana Maria Souza')).toBe('AS');
    expect(getInitials('ana')).toBe('A');
    expect(getInitials('  ')).toBe('');
  });
});

describe('Avatar (web)', () => {
  it('sem src: mostra iniciais com fallback de marca e rotulo acessivel', () => {
    render(<Avatar name="Ana Souza" />);
    const el = screen.getByRole('img', { name: 'Ana Souza' });
    expect(el.textContent).toBe('AS');
    expect(el.className).toContain('bg-brand-100');
    expect(el.className).toContain('text-brand-700');
  });

  it('com src: renderiza <img>; ao falhar, cai para iniciais', () => {
    render(<Avatar name="Bruno Lima" src="https://x/y.jpg" />);
    const img = screen.getByRole('img', { name: 'Bruno Lima' }) as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    fireEvent.error(img);
    expect(screen.getByText('BL')).toBeTruthy();
  });

  it('tamanho vem do token avatarSize (lg = 56px)', () => {
    render(<Avatar name="Ana" size="lg" />);
    const el = screen.getByRole('img', { name: 'Ana' });
    expect(el.style.width).toBe('56px');
    expect(el.style.height).toBe('56px');
  });

  it('bordered: borda branca de 2px', () => {
    render(<Avatar name="Ana" bordered />);
    expect(screen.getByRole('img', { name: 'Ana' }).className).toContain('border-2');
  });
});

describe('AvatarGroup (web)', () => {
  it('respeita max e condensa o excedente em +N', () => {
    render(
      <AvatarGroup max={2}>
        <Avatar name="Ana Souza" />
        <Avatar name="Bruno Lima" />
        <Avatar name="Carla Dias" />
        <Avatar name="Diego Alves" />
      </AvatarGroup>,
    );
    expect(screen.getByText('AS')).toBeTruthy();
    expect(screen.getByText('BL')).toBeTruthy();
    // 3o e 4o nao aparecem; vira "+2"
    expect(screen.queryByText('CD')).toBeNull();
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Mais 2' })).toBeTruthy();
  });
});

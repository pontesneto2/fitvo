import { describe, expect, it } from 'vitest';

import { iconDiameter, resolveIconColor } from './icon-variants';

describe('icon-variants', () => {
  it('tamanho vem do token iconSize', () => {
    expect(iconDiameter('sm')).toBe(16);
    expect(iconDiameter('md')).toBe(20);
    expect(iconDiameter('lg')).toBe(24);
  });

  it('default resolve o texto auxiliar do tema ativo (sem inversao manual)', () => {
    expect(resolveIconColor('default', 'light')).toBe('#48514E');
    expect(resolveIconColor('default', 'dark')).toBe('#B4BBB8');
    expect(resolveIconColor(undefined, 'light')).toBe('#48514E');
  });

  it('active e o stop fixo brand-600 nos dois temas', () => {
    expect(resolveIconColor('active', 'light')).toBe('#0C8862');
    expect(resolveIconColor('active', 'dark')).toBe('#0C8862');
  });

  it('string literal passa direto (cor pontual fora do fluxo de token)', () => {
    expect(resolveIconColor('#FF0000', 'light')).toBe('#FF0000');
  });
});

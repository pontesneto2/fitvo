import { avatarSize, colors } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { AVATAR_FALLBACK, avatarDiameter, avatarFontSize, getInitials } from './avatar-variants';

describe('avatar-variants (§18)', () => {
  it('getInitials: 1a+ultima palavra (ate 2), maiuscula', () => {
    expect(getInitials('Ana Souza')).toBe('AS');
    expect(getInitials('Ana Maria Souza')).toBe('AS');
    expect(getInitials('ana')).toBe('A');
    expect(getInitials('   ')).toBe('');
  });

  it('diametro vem do token avatarSize', () => {
    expect(avatarDiameter('xs')).toBe(avatarSize.xs);
    expect(avatarDiameter('xl')).toBe(avatarSize.xl);
  });

  it('fonte das iniciais e ~40% do diametro', () => {
    expect(avatarFontSize('md')).toBe(Math.round(avatarSize.md * 0.4));
  });

  it('fallback de marca: brand-100 fundo, brand-700 texto (agnostico)', () => {
    expect(AVATAR_FALLBACK).toEqual({
      backgroundColor: colors.brand[100],
      textColor: colors.brand[700],
    });
  });
});

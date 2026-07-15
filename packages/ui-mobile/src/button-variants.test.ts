import { colors, white } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import type { ButtonVariant } from './button-variants';
import { resolveColors, SIZES } from './button-variants';

const DISABLED_FG = '#SUTIL'; // sentinela: prova que o disabled usa o fg do tema

describe('SIZES', () => {
  it('mapeia altura/padding/fonte por tamanho (§1)', () => {
    expect(SIZES.sm.height).toBe(32);
    expect(SIZES.md.height).toBe(40);
    expect(SIZES.lg.height).toBe(48);
    expect(SIZES.md.paddingHorizontal).toBe(16);
    expect(SIZES.lg.fontSize).toBe(16);
  });
});

describe('resolveColors — estados por variante (§1)', () => {
  it('primary: brand-500 normal, brand-700 pressed, texto branco', () => {
    expect(resolveColors('primary', false, false, DISABLED_FG)).toMatchObject({
      backgroundColor: colors.brand[500],
      color: white,
      borderWidth: 0,
    });
    expect(resolveColors('primary', true, false, DISABLED_FG).backgroundColor).toBe(
      colors.brand[700],
    );
  });

  it('energy: texto escuro (brand-900) normal, vira branco no pressed', () => {
    expect(resolveColors('energy', false, false, DISABLED_FG)).toMatchObject({
      backgroundColor: colors.energy[400],
      color: colors.brand[900],
    });
    expect(resolveColors('energy', true, false, DISABLED_FG)).toMatchObject({
      backgroundColor: colors.energy[600],
      color: white,
    });
  });

  it('secondary: outline (borderWidth 1), fundo transparente normal', () => {
    const normal = resolveColors('secondary', false, false, DISABLED_FG);
    expect(normal).toMatchObject({
      backgroundColor: 'transparent',
      color: colors.brand[600],
      borderColor: colors.neutral[200],
      borderWidth: 1,
    });
    expect(resolveColors('secondary', true, false, DISABLED_FG)).toMatchObject({
      backgroundColor: colors.brand[100],
      borderColor: colors.brand[500],
    });
  });

  it('ghost: transparente normal, neutral-200 pressed', () => {
    expect(resolveColors('ghost', false, false, DISABLED_FG).backgroundColor).toBe('transparent');
    expect(resolveColors('ghost', true, false, DISABLED_FG).backgroundColor).toBe(
      colors.neutral[200],
    );
  });

  it('destructive: danger-400 normal, danger-600 pressed', () => {
    expect(resolveColors('destructive', false, false, DISABLED_FG).backgroundColor).toBe(
      colors.danger[400],
    );
    expect(resolveColors('destructive', true, false, DISABLED_FG).backgroundColor).toBe(
      colors.danger[600],
    );
  });

  it('disabled: usa o fg do tema e ignora o pressed, em toda variante', () => {
    const variants: ButtonVariant[] = ['primary', 'energy', 'secondary', 'ghost', 'destructive'];
    for (const v of variants) {
      const off = resolveColors(v, false, true, DISABLED_FG);
      const offPressed = resolveColors(v, true, true, DISABLED_FG);
      expect(off.color, `${v} disabled fg`).toBe(DISABLED_FG);
      // pressed nao muda nada quando disabled
      expect(offPressed).toEqual(off);
    }
  });

  it('preenchidas usam neutral-200 no disabled; outline/ghost ficam transparentes', () => {
    expect(resolveColors('primary', false, true, DISABLED_FG).backgroundColor).toBe(
      colors.neutral[200],
    );
    expect(resolveColors('destructive', false, true, DISABLED_FG).backgroundColor).toBe(
      colors.neutral[200],
    );
    expect(resolveColors('secondary', false, true, DISABLED_FG).backgroundColor).toBe(
      'transparent',
    );
    expect(resolveColors('ghost', false, true, DISABLED_FG).backgroundColor).toBe('transparent');
  });
});

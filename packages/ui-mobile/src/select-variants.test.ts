import { colors, white } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import {
  resolveMenuColors,
  resolveSelectItemColors,
  type SelectItemTextColors,
} from './select-variants';

const TEXT: SelectItemTextColors = { principal: '#111111', sutil: '#999999' };

describe('resolveMenuColors (§3 + §21)', () => {
  it('light: superficie branca (surfaceRaised), borda neutral-200', () => {
    expect(resolveMenuColors('light')).toEqual({
      backgroundColor: white,
      borderColor: colors.neutral[200],
    });
  });

  it('dark: superficie neutral-800, borda neutral-700', () => {
    expect(resolveMenuColors('dark')).toEqual({
      backgroundColor: colors.neutral[800],
      borderColor: colors.neutral[700],
    });
  });
});

describe('resolveSelectItemColors (§3)', () => {
  it('normal: transparente, texto principal, sem check', () => {
    expect(resolveSelectItemColors('light', false, false, false, TEXT)).toEqual({
      backgroundColor: 'transparent',
      textColor: TEXT.principal,
      checkColor: 'transparent',
    });
  });

  it('pressed (=hover do doc): neutral-100 (light) / neutral-700 (dark)', () => {
    expect(resolveSelectItemColors('light', false, false, true, TEXT).backgroundColor).toBe(
      colors.neutral[100],
    );
    expect(resolveSelectItemColors('dark', false, false, true, TEXT).backgroundColor).toBe(
      colors.neutral[700],
    );
  });

  it('selecionado: brand-50 / brand-700 + check brand-500 (agnostico de tema)', () => {
    expect(resolveSelectItemColors('dark', true, false, false, TEXT)).toEqual({
      backgroundColor: colors.brand[50],
      textColor: colors.brand[700],
      checkColor: colors.brand[500],
    });
  });

  it('disabled vence pressed e selecionado: texto sutil, sem check', () => {
    expect(resolveSelectItemColors('light', true, true, true, TEXT)).toEqual({
      backgroundColor: 'transparent',
      textColor: TEXT.sutil,
      checkColor: 'transparent',
    });
  });
});

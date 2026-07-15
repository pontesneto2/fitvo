import { colors, white } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { resolveCheckboxColors, resolveRadioColors } from './toggle-variants';

describe('resolveCheckboxColors (§4)', () => {
  it('normal: transparente, borda neutral-300 (light) / neutral-600 (dark)', () => {
    expect(resolveCheckboxColors('light', false, false, false, false)).toMatchObject({
      backgroundColor: 'transparent',
      borderColor: colors.neutral[300],
      markColor: 'transparent',
    });
    expect(resolveCheckboxColors('dark', false, false, false, false).borderColor).toBe(
      colors.neutral[600],
    );
  });

  it('pressed (=hover do doc): brand-50 / brand-400', () => {
    expect(resolveCheckboxColors('light', false, false, false, true)).toMatchObject({
      backgroundColor: colors.brand[50],
      borderColor: colors.brand[400],
    });
  });

  it('marcado: brand-500 e check branco; pressed escurece p/ brand-600', () => {
    expect(resolveCheckboxColors('light', true, false, false, false)).toMatchObject({
      backgroundColor: colors.brand[500],
      borderColor: colors.brand[500],
      markColor: white,
    });
    expect(resolveCheckboxColors('light', true, false, false, true).backgroundColor).toBe(
      colors.brand[600],
    );
  });

  it('disabled marcado: neutral-300/neutral-600, check neutral-50', () => {
    expect(resolveCheckboxColors('light', true, true, false, false)).toMatchObject({
      backgroundColor: colors.neutral[300],
      markColor: colors.neutral[50],
    });
    expect(resolveCheckboxColors('dark', true, true, false, false).backgroundColor).toBe(
      colors.neutral[600],
    );
  });

  it('erro: borda danger-400', () => {
    expect(resolveCheckboxColors('light', false, false, true, false).borderColor).toBe(
      colors.danger[400],
    );
  });
});

describe('resolveRadioColors (§5)', () => {
  it('selecionado: fundo branco (light) / neutral-900 (dark), borda e ponto brand-500', () => {
    expect(resolveRadioColors('light', true, false, false, false)).toMatchObject({
      backgroundColor: white,
      borderColor: colors.brand[500],
      dotColor: colors.brand[500],
    });
    expect(resolveRadioColors('dark', true, false, false, false).backgroundColor).toBe(
      colors.neutral[900],
    );
  });

  it('normal / pressed / disabled / erro', () => {
    expect(resolveRadioColors('light', false, false, false, false).borderColor).toBe(
      colors.neutral[300],
    );
    expect(resolveRadioColors('light', false, false, false, true).borderColor).toBe(
      colors.brand[400],
    );
    expect(resolveRadioColors('light', false, true, false, false).backgroundColor).toBe(
      colors.neutral[100],
    );
    expect(resolveRadioColors('light', false, false, true, false).borderColor).toBe(
      colors.danger[400],
    );
  });
});

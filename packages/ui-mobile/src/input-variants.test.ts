import { colors, white } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { INPUT_DIMS, resolveInputColors } from './input-variants';

const TEXT = { principal: '#PRIN', auxiliar: '#AUX', sutil: '#SUT' };
const at = (
  mode: 'light' | 'dark',
  status: 'default' | 'error' | 'success',
  focused: boolean,
  disabled: boolean,
  readOnly: boolean,
) => resolveInputColors(mode, status, focused, disabled, readOnly, TEXT);

describe('INPUT_DIMS', () => {
  it('altura 40, raio 8, padding 12, fonte 14 (§2)', () => {
    expect(INPUT_DIMS).toMatchObject({
      height: 40,
      borderRadius: 8,
      paddingHorizontal: 12,
      fontSize: 14,
      borderWidth: 1,
    });
  });
});

describe('resolveInputColors — light (§2)', () => {
  it('normal: fundo neutral-50, borda neutral-200, texto principal', () => {
    expect(at('light', 'default', false, false, false)).toMatchObject({
      backgroundColor: colors.neutral[50],
      borderColor: colors.neutral[200],
      color: TEXT.principal,
      placeholderColor: TEXT.sutil,
    });
  });
  it('foco: fundo branco, borda brand-500', () => {
    expect(at('light', 'default', true, false, false)).toMatchObject({
      backgroundColor: white,
      borderColor: colors.brand[500],
    });
  });
  it('disabled: fundo neutral-100, texto sutil', () => {
    expect(at('light', 'default', false, true, false)).toMatchObject({
      backgroundColor: colors.neutral[100],
      color: TEXT.sutil,
    });
  });
  it('readonly: fundo neutral-100, texto auxiliar', () => {
    expect(at('light', 'default', false, false, true)).toMatchObject({
      backgroundColor: colors.neutral[100],
      color: TEXT.auxiliar,
    });
  });
  it('error: fundo danger-50, borda danger-400', () => {
    expect(at('light', 'error', false, false, false)).toMatchObject({
      backgroundColor: colors.danger[50],
      borderColor: colors.danger[400],
    });
  });
  it('success: fundo energy-50, borda energy-500', () => {
    expect(at('light', 'success', false, false, false)).toMatchObject({
      backgroundColor: colors.energy[50],
      borderColor: colors.energy[500],
    });
  });
});

describe('resolveInputColors — dark (§21)', () => {
  it('normal: fundo neutral-800, borda neutral-700', () => {
    expect(at('dark', 'default', false, false, false)).toMatchObject({
      backgroundColor: colors.neutral[800],
      borderColor: colors.neutral[700],
    });
  });
  it('foco: fundo neutral-900, borda brand-400', () => {
    expect(at('dark', 'default', true, false, false)).toMatchObject({
      backgroundColor: colors.neutral[900],
      borderColor: colors.brand[400],
    });
  });
  it('error: fundo danger-900 a 20%, borda danger-400', () => {
    expect(at('dark', 'error', false, false, false)).toMatchObject({
      backgroundColor: 'rgba(56, 12, 12, 0.2)',
      borderColor: colors.danger[400],
    });
  });
  it('error persiste sobre o foco (borda/fundo de erro, nao de foco)', () => {
    expect(at('dark', 'error', true, false, false).borderColor).toBe(colors.danger[400]);
  });
});

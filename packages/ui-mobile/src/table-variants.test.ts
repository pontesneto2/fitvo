import { colors, semanticColors } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import {
  resolveTableHeaderColors,
  resolveTableRowColors,
  tableSeparatorColor,
  tableSortIconColor,
} from './table-variants';

describe('table-variants (§16)', () => {
  it('cabecalho = superficie base (recessada): neutral-50 no light, neutral-900 no dark', () => {
    expect(resolveTableHeaderColors('light')).toEqual({
      backgroundColor: semanticColors.surfaceBase.light,
      textColor: semanticColors.textAuxiliar.light,
    });
    expect(resolveTableHeaderColors('dark').backgroundColor).toBe(colors.neutral[900]);
  });

  it('linha normal: surface-raised; selecionada: brand-50 (agnostico); pressed: sobe stop', () => {
    expect(resolveTableRowColors('light', false, false).backgroundColor).toBe(
      semanticColors.surfaceRaised.light,
    );
    expect(resolveTableRowColors('light', true, false).backgroundColor).toBe(colors.brand[50]);
    expect(resolveTableRowColors('dark', true, false).backgroundColor).toBe(colors.brand[50]);
    expect(resolveTableRowColors('light', false, true).backgroundColor).toBe(colors.neutral[50]);
    expect(resolveTableRowColors('dark', false, true).backgroundColor).toBe(colors.neutral[700]);
  });

  it('separador: neutral-100 no light, neutral-700 no dark', () => {
    expect(tableSeparatorColor('light')).toBe(colors.neutral[100]);
    expect(tableSeparatorColor('dark')).toBe(colors.neutral[700]);
  });

  it('icone de ordenacao: brand-500 quando ativo', () => {
    expect(tableSortIconColor('light', true)).toBe(colors.brand[500]);
    expect(tableSortIconColor('light', false)).toBe(semanticColors.textSutil.light);
  });
});

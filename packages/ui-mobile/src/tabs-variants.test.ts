import { colors, semanticColors } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { resolveTabColors, tabIndicatorColor } from './tabs-variants';

describe('resolveTabColors / tabIndicatorColor (§9)', () => {
  it('normal: texto auxiliar, fundo transparente', () => {
    expect(resolveTabColors('light', 'brand', false, false, false)).toEqual({
      textColor: semanticColors.textAuxiliar.light,
      backgroundColor: 'transparent',
    });
  });

  it('ativo: acento-700 no light, clareia p/ acento-400 no dark (fundo transparente)', () => {
    expect(resolveTabColors('light', 'brand', true, false, false).textColor).toBe(
      colors.brand[700],
    );
    expect(resolveTabColors('dark', 'brand', true, false, false).textColor).toBe(colors.brand[400]);
  });

  it('pressed (equivalente hover): texto principal + fundo neutro sobe um stop no dark', () => {
    expect(resolveTabColors('light', 'brand', false, false, true)).toEqual({
      textColor: semanticColors.textPrincipal.light,
      backgroundColor: colors.neutral[50],
    });
    expect(resolveTabColors('dark', 'brand', false, false, true).backgroundColor).toBe(
      colors.neutral[800],
    );
  });

  it('disabled: texto sutil', () => {
    expect(resolveTabColors('light', 'brand', false, true, false).textColor).toBe(
      semanticColors.textSutil.light,
    );
  });

  it('acento de ambiente: indicador e texto ativo usam a rampa do ambiente', () => {
    expect(tabIndicatorColor('training')).toBe(colors.lime[500]);
    expect(tabIndicatorColor('nutrition')).toBe(colors.amber[500]);
    expect(tabIndicatorColor('medicine')).toBe(colors.clinic[500]);
    expect(resolveTabColors('light', 'medicine', true, false, false).textColor).toBe(
      colors.clinic[700],
    );
  });
});

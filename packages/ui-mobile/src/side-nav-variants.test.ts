import { colors, semanticColors } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { resolveNavItemColors } from './side-nav-variants';

describe('resolveNavItemColors (§10)', () => {
  it('normal: fundo transparente, texto+icone auxiliar, sem barra', () => {
    expect(resolveNavItemColors('light', false, false, false)).toEqual({
      backgroundColor: 'transparent',
      textColor: semanticColors.textAuxiliar.light,
      iconColor: semanticColors.textAuxiliar.light,
      barColor: 'transparent',
    });
  });

  it('ativo: brand-50 fundo, brand-700 texto, brand-600 icone, barra brand-500 (agnostico)', () => {
    const light = resolveNavItemColors('light', true, false, false);
    expect(light).toEqual({
      backgroundColor: colors.brand[50],
      textColor: colors.brand[700],
      iconColor: colors.brand[600],
      barColor: colors.brand[500],
    });
    expect(resolveNavItemColors('dark', true, false, false)).toEqual(light);
  });

  it('pressed (equivalente hover): fundo neutro sobe um stop no dark, texto principal', () => {
    expect(resolveNavItemColors('light', false, false, true).backgroundColor).toBe(
      colors.neutral[100],
    );
    expect(resolveNavItemColors('dark', false, false, true).backgroundColor).toBe(
      colors.neutral[800],
    );
    expect(resolveNavItemColors('light', false, false, true).textColor).toBe(
      semanticColors.textPrincipal.light,
    );
  });

  it('disabled: texto+icone sutil, sem barra', () => {
    expect(resolveNavItemColors('light', false, true, false).textColor).toBe(
      semanticColors.textSutil.light,
    );
  });
});

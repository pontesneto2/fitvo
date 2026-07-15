import { colors, semanticColors } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { crumbSeparatorColor, resolveCrumbColor } from './breadcrumb-variants';

describe('resolveCrumbColor / crumbSeparatorColor (§11)', () => {
  it('normal: texto auxiliar (adapta por tema)', () => {
    expect(resolveCrumbColor('light', false, false)).toBe(semanticColors.textAuxiliar.light);
    expect(resolveCrumbColor('dark', false, false)).toBe(semanticColors.textAuxiliar.dark);
  });

  it('atual: texto principal', () => {
    expect(resolveCrumbColor('light', true, false)).toBe(semanticColors.textPrincipal.light);
  });

  it('pressed (equivalente hover): brand-600, agnostico de tema', () => {
    expect(resolveCrumbColor('light', false, true)).toBe(colors.brand[600]);
    expect(resolveCrumbColor('dark', false, true)).toBe(colors.brand[600]);
  });

  it('separador: texto sutil', () => {
    expect(crumbSeparatorColor('light')).toBe(semanticColors.textSutil.light);
    expect(crumbSeparatorColor('dark')).toBe(semanticColors.textSutil.dark);
  });
});

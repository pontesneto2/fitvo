import { colors, semanticColors } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { resolveBadgeColors } from './badge-variants';

describe('resolveBadgeColors (§8)', () => {
  it('neutral: fundo neutral-100 + texto auxiliar; adapta no dark (§21 "sobe na rampa")', () => {
    expect(resolveBadgeColors('light', 'neutral')).toEqual({
      backgroundColor: colors.neutral[100],
      textColor: semanticColors.textAuxiliar.light,
      removePressColor: colors.neutral[200],
    });
    expect(resolveBadgeColors('dark', 'neutral')).toEqual({
      backgroundColor: colors.neutral[700],
      textColor: semanticColors.textAuxiliar.dark,
      removePressColor: colors.neutral[600],
    });
  });

  it('acento: fundo tom-50 + texto tom-700/800, agnostico de tema', () => {
    expect(resolveBadgeColors('light', 'brand')).toMatchObject({
      backgroundColor: colors.brand[50],
      textColor: colors.brand[700],
    });
    // medicina usa clinic-800 (distingue do info=clinic-700)
    expect(resolveBadgeColors('light', 'medicine').textColor).toBe(colors.clinic[800]);
    expect(resolveBadgeColors('light', 'info').textColor).toBe(colors.clinic[700]);
    // agnostico: dark == light para acento
    expect(resolveBadgeColors('dark', 'nutrition')).toEqual(
      resolveBadgeColors('light', 'nutrition'),
    );
  });

  it('removePressColor e o tom-200 da mesma rampa (§8, equivalente touch do hover)', () => {
    expect(resolveBadgeColors('light', 'error').removePressColor).toBe(colors.danger[200]);
    expect(resolveBadgeColors('light', 'success').removePressColor).toBe(colors.energy[200]);
  });
});

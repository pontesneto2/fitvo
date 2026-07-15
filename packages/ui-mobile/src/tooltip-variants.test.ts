import { colors, semanticColors } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { resolveTooltipColors } from './tooltip-variants';

describe('resolveTooltipColors (§14)', () => {
  it('light: fundo neutral-800, texto neutral-50', () => {
    expect(resolveTooltipColors('light')).toEqual({
      backgroundColor: colors.neutral[800],
      textColor: colors.neutral[50],
    });
  });

  it('dark: INVERTE — fundo neutral-100, texto neutral-900', () => {
    expect(resolveTooltipColors('dark')).toEqual({
      backgroundColor: colors.neutral[100],
      textColor: colors.neutral[900],
    });
  });

  it('vem dos tokens semanticos tooltipSurface/tooltipText', () => {
    expect(resolveTooltipColors('light').backgroundColor).toBe(semanticColors.tooltipSurface.light);
    expect(resolveTooltipColors('dark').textColor).toBe(semanticColors.tooltipText.dark);
  });
});

import { colors } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { emptyIconColor, errorIconColor, resolveSkeletonColors } from './states-variants';

describe('states-variants (§15)', () => {
  it('skeleton: shimmer neutral-100->200 no light; sobe na rampa no dark (800->700)', () => {
    expect(resolveSkeletonColors('light')).toEqual({
      from: colors.neutral[100],
      to: colors.neutral[200],
    });
    expect(resolveSkeletonColors('dark')).toEqual({
      from: colors.neutral[800],
      to: colors.neutral[700],
    });
  });

  it('icone do vazio: neutral-300; icone de erro: danger-400 (agnosticos)', () => {
    expect(emptyIconColor).toBe(colors.neutral[300]);
    expect(errorIconColor).toBe(colors.danger[400]);
  });
});

import { colors } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { LOGO_ICON_COLORS, LOGO_WORDMARK_ASPECT } from './logo-variants';

describe('logo-variants (§9/§20)', () => {
  it('proporção do wordmark ~1.642 (largura/altura da arte)', () => {
    expect(LOGO_WORDMARK_ASPECT).toBeCloseTo(1.642, 2);
  });

  it('cores do ícone provisório = tokens brand-500 (traço) + energy-400 (detalhe)', () => {
    expect(LOGO_ICON_COLORS.stroke).toBe(colors.brand[500]);
    expect(LOGO_ICON_COLORS.accent).toBe(colors.energy[400]);
  });
});

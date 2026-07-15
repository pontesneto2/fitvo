import { colors } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { resolveToastColors, resolveToastDuration } from './toast-variants';

describe('toast-variants (§13)', () => {
  it('success: fundo energy-50, acento energy-500, icone energy-600', () => {
    expect(resolveToastColors('success')).toMatchObject({
      backgroundColor: colors.energy[50],
      accentColor: colors.energy[500],
      iconColor: colors.energy[600],
    });
  });

  it('error: acento danger-400 (mais claro que os -500 dos outros)', () => {
    expect(resolveToastColors('error').accentColor).toBe(colors.danger[400]);
  });

  it('titulo/descricao fixam tons escuros (agnostico de tema) em toda variante', () => {
    for (const v of ['success', 'error', 'warning', 'info', 'achievement'] as const) {
      const c = resolveToastColors(v);
      expect(c.titleColor).toBe(colors.neutral[900]);
      expect(c.descColor).toBe(colors.neutral[600]);
    }
  });

  it('duracao: padrao 5000, error manual (null), valor explicito vence', () => {
    expect(resolveToastDuration('info', undefined)).toBe(5000);
    expect(resolveToastDuration('error', undefined)).toBeNull();
    expect(resolveToastDuration('error', 3000)).toBe(3000);
    expect(resolveToastDuration('success', null)).toBeNull();
  });
});

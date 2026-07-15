import { radius, scrim, semanticColors, space } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { MODAL_DIMS, MODAL_MAX_WIDTH, modalScrim, resolveModalColors } from './modal-variants';

describe('modal-variants (§12)', () => {
  it('larguras maximas: sm 400 / md 560 / lg 720', () => {
    expect(MODAL_MAX_WIDTH).toEqual({ sm: 400, md: 560, lg: 720 });
  });

  it('dims: raio lg, padding space-6', () => {
    expect(MODAL_DIMS.borderRadius).toBe(radius.lg);
    expect(MODAL_DIMS.padding).toBe(space[6]);
  });

  it('painel usa surfaceRaised e textos semanticos (adapta por tema)', () => {
    expect(resolveModalColors('light')).toEqual({
      backgroundColor: semanticColors.surfaceRaised.light,
      titleColor: semanticColors.textPrincipal.light,
      bodyColor: semanticColors.textAuxiliar.light,
    });
    expect(resolveModalColors('dark').backgroundColor).toBe(semanticColors.surfaceRaised.dark);
  });

  it('veu embute a opacidade do scrim como rgba (neutral-900 a 60%)', () => {
    // scrim.color = neutral-900 (#0F1513), opacity 0.6
    expect(modalScrim.color).toBe('rgba(15, 21, 19, 0.6)');
    expect(scrim.opacity).toBe(0.6);
  });
});

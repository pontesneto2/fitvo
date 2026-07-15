import { describe, expect, it } from 'vitest';

import { markAccentSize, markDiameter, WORDMARK_COLORS, wordmarkFontSize } from './logo-variants';

describe('logo-variants', () => {
  it('wordmark: FIT em brand-500, VO em energy-400', () => {
    expect(WORDMARK_COLORS.fit).toBe('#0FA678');
    expect(WORDMARK_COLORS.vo).toBe('#00E676');
  });

  it('tamanho do texto do wordmark segue fontSize.h3/h2/h1', () => {
    expect(wordmarkFontSize('sm')).toBe(18);
    expect(wordmarkFontSize('md')).toBe(24);
    expect(wordmarkFontSize('lg')).toBe(28);
  });

  it('mark provisorio: diametro do token + acento proporcional', () => {
    expect(markDiameter('md')).toBe(28);
    expect(markAccentSize('md')).toBe(14);
  });
});

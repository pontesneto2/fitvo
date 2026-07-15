import { colors, white } from '@fitvo/brand-tokens';
import { describe, expect, it } from 'vitest';

import { resolveCardColors } from './card-variants';

describe('resolveCardColors (§7 + §21)', () => {
  it('default: superficie raised, borda line, sem sombra', () => {
    expect(resolveCardColors('light', 'default', false)).toEqual({
      backgroundColor: white,
      borderColor: colors.neutral[200],
      borderWidth: 1,
      elevation: 'flat',
    });
    expect(resolveCardColors('dark', 'default', false)).toMatchObject({
      backgroundColor: colors.neutral[800],
      borderColor: colors.neutral[700],
    });
  });

  it('interactive: pressed usa superficie base + borda hover (o "ativo" do §7)', () => {
    expect(resolveCardColors('light', 'interactive', false).backgroundColor).toBe(white);
    expect(resolveCardColors('light', 'interactive', true)).toMatchObject({
      backgroundColor: colors.neutral[50],
      borderColor: colors.neutral[300],
      elevation: 'flat',
    });
    expect(resolveCardColors('dark', 'interactive', true).backgroundColor).toBe(
      colors.neutral[900],
    );
  });

  it('attention: borda brand-300 e elevacao raised (o unico que pede atencao)', () => {
    expect(resolveCardColors('light', 'attention', false)).toMatchObject({
      borderColor: colors.brand[300],
      elevation: 'raised',
    });
    // Marca e agnostica de tema.
    expect(resolveCardColors('dark', 'attention', false).borderColor).toBe(colors.brand[300]);
  });

  it('selected: fundo brand-50, borda 1.5px brand-500, sombra subtle', () => {
    expect(resolveCardColors('light', 'selected', false)).toEqual({
      backgroundColor: colors.brand[50],
      borderColor: colors.brand[500],
      borderWidth: 1.5,
      elevation: 'subtle',
    });
  });
});

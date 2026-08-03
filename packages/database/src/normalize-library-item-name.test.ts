import { describe, expect, it } from 'vitest';

import { normalizeLibraryItemName } from './normalize-library-item-name';

/**
 * D-169 (ADR-0009): a anti-duplicacao da base comum e NORMALIZADA. Igualdade
 * literal de string NAO satisfaz a decisao — estes casos sao exatamente os que
 * o ADR cita como "o mesmo item".
 */
describe('normalizeLibraryItemName (D-169)', () => {
  it.each([
    ['case', 'Supino Reto', 'supino reto'],
    ['acento', 'Tríceps testa', 'triceps testa'],
    ['til e cedilha', 'Elevação de panturrilha', 'elevacao de panturrilha'],
    ['hifen', 'supino-reto', 'supino reto'],
    ['underline', 'supino_reto', 'supino reto'],
    ['espaco duplicado', 'supino   reto', 'supino reto'],
    ['borda', '  supino reto  ', 'supino reto'],
    ['tab/quebra de linha', 'supino\treto', 'supino reto'],
  ])('normaliza %s: "%s" -> "%s"', (_label, input, expected) => {
    expect(normalizeLibraryItemName(input)).toBe(expected);
  });

  it('as variantes que o D-169 chama de "mesmo item" colapsam na MESMA chave', () => {
    const variants = [
      'supino reto',
      'Supino Reto',
      'SUPINO-RETO',
      '  supino_reto ',
      'Supino  Réto',
    ];
    const keys = new Set(variants.map(normalizeLibraryItemName));
    expect(keys.size).toBe(1);
  });

  it('nomes diferentes NAO colapsam (a normalizacao nao pode ser agressiva demais)', () => {
    expect(normalizeLibraryItemName('Supino reto')).not.toBe(
      normalizeLibraryItemName('Supino inclinado'),
    );
    expect(normalizeLibraryItemName('Rosca direta')).not.toBe(
      normalizeLibraryItemName('Rosca martelo'),
    );
  });

  it('nome so de separadores vira string VAZIA — o chamador tem que rejeitar', () => {
    // Se isso virasse chave valida, qualquer nome degenerado casaria com
    // qualquer outro. Quem valida e o service (InvalidLibraryItemNameError).
    expect(normalizeLibraryItemName(' --- ')).toBe('');
    expect(normalizeLibraryItemName('___')).toBe('');
  });
});

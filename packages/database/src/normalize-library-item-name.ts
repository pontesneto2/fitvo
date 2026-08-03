/**
 * Normalizacao canonica de nome de item de biblioteca (D-169 — ADR-0009).
 *
 * O D-169 exige que a base comum so cresca por ANTI-DUPLICACAO NORMALIZADA:
 * "supino reto", "Supino Reto" e "supino-reto" sao o MESMO item, e igualdade
 * literal de string NAO satisfaz a decisao. Esta funcao e a unica fonte da
 * normalizacao; a coluna `exercise.nameNormalized` e sempre derivada dela,
 * nunca preenchida a mao.
 *
 * Mora em @fitvo/database (e nao no modulo da API) porque e a regra que da
 * sentido a uma COLUNA persistida: quem escreve a coluna e quem consulta por ela
 * tem que usar exatamente a mesma definicao, inclusive fora da API (worker,
 * script de importacao da base comum).
 *
 * Passos, nesta ordem:
 * 1. `normalize('NFD')` decompoe letra + acento em code points separados e o
 *    `replace` remove a faixa de diacriticos combinantes (U+0300–U+036F) —
 *    cobre qualquer acento, nao so o conjunto pt-BR.
 * 2. minusculo (case-insensitive).
 * 3. espaco/hifen/underline viram UM espaco (separador-insensitive).
 * 4. aparado.
 */
export function normalizeLibraryItemName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

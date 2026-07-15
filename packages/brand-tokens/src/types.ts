/**
 * @fitvo/brand-tokens — contratos compartilhados dos tokens.
 *
 * Tipos data-independentes (nao derivam de nenhuma tabela de dados), entao este
 * arquivo nao importa nada e nunca cria ciclo. As tabelas em colors.ts,
 * semantic-colors.ts etc. importam estes tipos e derivam seus proprios
 * name-types locais via `keyof typeof`.
 */

/**
 * Modo de tema. O dark e resolvido por token (theme.ts), nunca por inversao
 * manual no componente (design-system.md §8).
 */
export type ThemeMode = 'light' | 'dark';

/** Par light/dark de um token semantico de cor. Ambos obrigatorios (§8). */
export interface ThemedColor {
  readonly light: string;
  readonly dark: string;
}

/** Stops canonicos das rampas (design-system.md §3). Contrato fixo 50 -> 900. */
export type ColorStop = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/**
 * Uma rampa completa: um hex por stop. Mapped type sobre uniao finita (nao
 * `Record<string, string>`), portanto expoe propriedades conhecidas e nao uma
 * index signature — `ramp[500]` e `ramp[stopVar]` retornam `string`, nunca
 * `string | undefined` (evita atrito com `noUncheckedIndexedAccess`).
 */
export type ColorRamp = { readonly [S in ColorStop]: string };

/**
 * Chave de densidade (design-system.md §6): mesmos tokens, espacamento ajustado
 * por contexto.
 */
export type DensityMode = 'compact' | 'comfortable';

/**
 * Ambientes por especialidade (design-system.md §7). Cor-mae (brand) e neutros
 * permanecem constantes; so o acento muda por ambiente.
 */
export type Environment = 'treino' | 'nutricao' | 'medicina';

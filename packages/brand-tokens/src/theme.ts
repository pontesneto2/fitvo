import type { SemanticColorName } from './semantic-colors';
import { cssVarNames, semanticColors } from './semantic-colors';
import type { ThemeMode } from './types';

/**
 * Resolucao de tema — a fonte UNICA do mapeamento light<->dark, sem dependencia
 * de framework (retorna dado puro). A web resolve pela cascata CSS (:root/.dark);
 * o mobile resolve em runtime (useColorScheme). Manter estes helpers aqui evita
 * cada ui-* re-derivar a resolucao — a duplicacao/"inversao manual" que o §8
 * proibe. A cola de framework (preset Tailwind, ThemeProvider RN, injecao de CSS)
 * mora em ui-web/ui-mobile.
 */
export type ResolvedTheme = { readonly [K in SemanticColorName]: string };

/** Achata os pares {light,dark} para um modo (consumo direto no RN). */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  const resolved = {} as { -readonly [K in SemanticColorName]: string };
  for (const key of Object.keys(semanticColors) as SemanticColorName[]) {
    resolved[key] = semanticColors[key][mode];
  }
  return resolved;
}

/**
 * Mapa nome -> valor das CSS custom properties, para injetar em :root / .dark
 * (web).
 */
export function toCssVariables(mode: ThemeMode): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of Object.keys(semanticColors) as SemanticColorName[]) {
    vars[cssVarNames[key]] = semanticColors[key][mode];
  }
  return vars;
}

/** Referencia `var(...)` de um token semantico, para o mapeamento Tailwind (web). */
export function cssVarRef(token: SemanticColorName): string {
  return `var(${cssVarNames[token]})`;
}

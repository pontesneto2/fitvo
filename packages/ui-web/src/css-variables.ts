import { toCssVariables } from '@fitvo/brand-tokens';

/**
 * Geracao das CSS custom properties da marca para a WEB (design-system.md §8).
 *
 * A cola web resolve o tema pela CASCATA CSS: as variaveis semanticas vivem em
 * `:root` (light) e sao sobrescritas em `.dark` (dark). Cada `var(--token)`
 * referenciada no preset Tailwind (ver `tailwind-preset.ts`) aponta para o valor
 * ativo do modo corrente — o componente nunca inverte cor a mao. Emitir este CSS
 * uma vez no layout raiz (ex.: `globals.css` do Next) e a UNICA injecao necessaria.
 *
 * Os nomes das variaveis e os valores por modo vem de `toCssVariables` no
 * brand-tokens (fonte unica) — este modulo so formata os blocos CSS.
 */
export interface ThemeCssOptions {
  /** Seletor do bloco light (padrao `:root`). */
  readonly rootSelector?: string;
  /** Seletor do bloco dark (padrao `.dark`, alinhado a `darkMode: 'class'`). */
  readonly darkSelector?: string;
}

function block(selector: string, vars: Record<string, string>): string {
  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

/**
 * String CSS com os blocos `:root` (light) e `.dark` (dark) das variaveis
 * semanticas. Injetar no CSS global do app web.
 */
export function buildThemeCss(options?: ThemeCssOptions): string {
  const rootSelector = options?.rootSelector ?? ':root';
  const darkSelector = options?.darkSelector ?? '.dark';
  return `${block(rootSelector, toCssVariables('light'))}\n\n${block(
    darkSelector,
    toCssVariables('dark'),
  )}\n`;
}

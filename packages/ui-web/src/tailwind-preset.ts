import type { SemanticColorName } from '@fitvo/brand-tokens';
import {
  avatarSize,
  black,
  colors,
  controlHeight,
  cssVarRef,
  duration,
  easing,
  easingToCss,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  shadows,
  shadowToCss,
  space,
  white,
} from '@fitvo/brand-tokens';

/**
 * Preset Tailwind da marca (design-system.md §8) — a cola entre os tokens
 * framework-neutros e o Tailwind da camada web. As cores SEMANTICAS mapeiam para
 * `var(--token)` (resolvidas por `buildThemeCss` em `:root`/`.dark`), entao classes
 * como `bg-surface-base` ou `text-text-principal` seguem o tema sem inversao manual.
 * As rampas PRIMITIVAS (brand, neutral, danger…) entram como valor fixo — sao
 * agnosticas de tema (paleta unica). Escalas nao-cor (espaco, raio, sombra, fonte,
 * movimento) vem direto dos tokens, mantendo o Tailwind como consumidor, nao fonte.
 *
 * Tipado por estrutura (sem depender do pacote `tailwindcss`): o objeto e o shape
 * de `theme.extend` aceito pelas versoes atuais do Tailwind. Uso no app:
 *
 *   // tailwind.config.ts
 *   import { fitvoTailwindPreset } from '@fitvo/ui-web/tailwind';
 *   export default { content: [...], presets: [fitvoTailwindPreset] };
 */
type TokenScale = Record<string, string>;

interface FitvoTailwindTheme {
  readonly colors: Record<string, string | Record<string | number, string>>;
  readonly spacing: TokenScale;
  readonly borderRadius: TokenScale;
  readonly fontFamily: Record<string, readonly string[]>;
  readonly fontSize: TokenScale;
  readonly fontWeight: TokenScale;
  readonly lineHeight: TokenScale;
  readonly height: TokenScale;
  readonly width: TokenScale;
  readonly boxShadow: TokenScale;
  readonly transitionDuration: TokenScale;
  readonly transitionTimingFunction: TokenScale;
}

function px(scale: Record<string, number>): TokenScale {
  const out: TokenScale = {};
  for (const [key, value] of Object.entries(scale)) {
    out[key] = `${value}px`;
  }
  return out;
}

/**
 * Chave Tailwind de cada cor semantica. Evita o "duplo" feio que sai de casar o
 * prefixo da utility com o nome do token (`text-` + `text-sutil` = `text-text-
 * sutil`; `border-` + `border-default` = `border-border-default`): texto -> `fg*`,
 * borda -> `line*`, superficie -> `surface*`, anel -> `focus`. As CSS vars
 * (`--text-*`, `--border-*`, ...) permanecem como IDENTIDADE canonica do token
 * (§0); aqui so nomeamos a utility. Uso: `bg-surface`, `text-fg-subtle`,
 * `border-line`, `ring-focus`.
 */
const SEMANTIC_TW_KEY: Record<SemanticColorName, string> = {
  textPrincipal: 'fg',
  textAuxiliar: 'fg-muted',
  textSutil: 'fg-subtle',
  surfaceBase: 'surface',
  surfaceRaised: 'surface-raised',
  surfaceOverlay: 'surface-overlay',
  borderDefault: 'line',
  borderHover: 'line-hover',
  borderFocus: 'line-focus',
  tooltipSurface: 'tooltip',
  tooltipText: 'tooltip-fg',
  focusRing: 'focus',
};

/** Cores semanticas -> `var(--token)`, sob a chave Tailwind limpa (ver acima). */
function semanticColorVars(): TokenScale {
  const out: TokenScale = {};
  for (const name of Object.keys(SEMANTIC_TW_KEY) as SemanticColorName[]) {
    out[SEMANTIC_TW_KEY[name]] = cssVarRef(name);
  }
  return out;
}

const headingStack = [fontFamily.heading, 'ui-sans-serif', 'system-ui', 'sans-serif'] as const;
const bodyStack = [fontFamily.body, 'ui-sans-serif', 'system-ui', 'sans-serif'] as const;

/**
 * Cores expostas ao Tailwind. Tipado com indice string (`FitvoTailwindTheme
 * ['colors']`) para que tanto as rampas primitivas quanto as chaves semanticas
 * geradas em runtime sejam indexaveis.
 */
const tailwindColors: FitvoTailwindTheme['colors'] = {
  white,
  black,
  ...colors,
  ...semanticColorVars(),
};

/** Objeto para `theme.extend`. Exposto separado para composicao fina no app. */
export const fitvoTailwindTheme = {
  colors: tailwindColors,
  spacing: px(space),
  borderRadius: px(radius),
  fontFamily: {
    heading: headingStack,
    body: bodyStack,
  },
  fontSize: px(fontSize),
  fontWeight: {
    regular: String(fontWeight.regular),
    medium: String(fontWeight.medium),
    semibold: String(fontWeight.semibold),
  },
  lineHeight: {
    tight: String(lineHeight.tight),
    snug: String(lineHeight.snug),
    normal: String(lineHeight.normal),
    relaxed: String(lineHeight.relaxed),
  },
  height: px(controlHeight),
  width: px(avatarSize),
  boxShadow: {
    flat: shadowToCss(shadows.flat.light),
    subtle: shadowToCss(shadows.subtle.light),
    raised: shadowToCss(shadows.raised.light),
    overlay: shadowToCss(shadows.overlay.light),
  },
  transitionDuration: {
    instant: `${duration.instant}ms`,
    fast: `${duration.fast}ms`,
    normal: `${duration.normal}ms`,
    slow: `${duration.slow}ms`,
  },
  transitionTimingFunction: {
    standard: easingToCss(easing.standard),
    in: easingToCss(easing.in),
    out: easingToCss(easing.out),
  },
} satisfies FitvoTailwindTheme;

/**
 * Preset completo. `darkMode: 'class'` casa com o bloco `.dark` de `buildThemeCss`
 * (o app alterna o tema adicionando/removendo a classe `dark` na raiz).
 */
export const fitvoTailwindPreset = {
  darkMode: 'class',
  theme: {
    extend: fitvoTailwindTheme,
  },
} satisfies { darkMode: 'class'; theme: { extend: FitvoTailwindTheme } };

import type { ColorStop } from './types';

/**
 * Rampas primitivas 50 -> 900 (design-system.md §3). Os valores sao a referencia
 * em light mode; o tema e resolvido nos tokens semanticos (semantic-colors.ts) e
 * na camada de UI — as rampas em si sao agnosticas de tema (paleta unica,
 * compartilhada por web e mobile).
 *
 * `as const satisfies Record<string, Record<ColorStop, string>>`: o `satisfies`
 * valida que toda rampa tem exatamente os stops 50–900 (rejeita stop faltando ou
 * excedente) sem alargar os tipos; o `as const` preserva os literais para derivar
 * `ColorName = keyof typeof colors` e para acesso exato como `colors.brand[500]`.
 */
export const colors = {
  brand: {
    50: '#E6F7F1',
    100: '#C1EDDD',
    200: '#8EDCC3',
    300: '#54C7A4',
    400: '#22B088',
    500: '#0FA678',
    600: '#0C8862',
    700: '#0A6E50',
    800: '#08543E',
    900: '#053A2B',
  },
  energy: {
    50: '#E4FFF0',
    100: '#B9FFD9',
    200: '#7DFFB8',
    300: '#3DFF97',
    400: '#00E676',
    500: '#00C765',
    600: '#00A554',
    700: '#008443',
    800: '#006332',
    900: '#004321',
  },
  lime: {
    50: '#F0FFE6',
    100: '#DBFFC0',
    200: '#BFFF8E',
    300: '#9CFF52',
    400: '#39FF14',
    500: '#5FD40F',
    600: '#4DAE0C',
    700: '#3B8709',
    800: '#2A6206',
    900: '#193B04',
  },
  amber: {
    50: '#FFF6E6',
    100: '#FFE9C0',
    200: '#FFD68E',
    300: '#FFBE52',
    400: '#FF9F1C',
    500: '#E58200',
    600: '#BD6A00',
    700: '#945300',
    800: '#6B3C00',
    900: '#422500',
  },
  clinic: {
    50: '#E6F4FC',
    100: '#C0E2F7',
    200: '#8ECBEF',
    300: '#52AEE3',
    400: '#2D9CDB',
    500: '#1B7FB8',
    600: '#146695',
    700: '#0E4D72',
    800: '#08344F',
    900: '#04202F',
  },
  purple: {
    50: '#F0EDFC',
    100: '#D6CCF6',
    200: '#B7A6EE',
    300: '#9781E4',
    400: '#7B5FD8',
    500: '#6242C0',
    600: '#4E3399',
    700: '#3B2673',
    800: '#29184F',
    900: '#180D2E',
  },
  pink: {
    50: '#FCEAF2',
    100: '#F7C2D8',
    200: '#EF93B6',
    300: '#E66492',
    400: '#DB3D74',
    500: '#C02460',
    600: '#991B4C',
    700: '#731338',
    800: '#4F0C26',
    900: '#2E0616',
  },
  cyan: {
    50: '#E4FBFC',
    100: '#B6F2F6',
    200: '#82E6ED',
    300: '#45D4DE',
    400: '#1CBFCB',
    500: '#109FA9',
    600: '#0C7E86',
    700: '#095E64',
    800: '#063E42',
    900: '#032325',
  },
  danger: {
    50: '#FCEBEB',
    100: '#F7C1C1',
    200: '#F09595',
    300: '#EA6B6A',
    400: '#E24B4A',
    500: '#C43231',
    600: '#A32D2D',
    700: '#7E2020',
    800: '#591414',
    900: '#380C0C',
  },
  warning: {
    50: '#FFF8E6',
    100: '#FDECC0',
    200: '#FBDC8E',
    300: '#F9C94E',
    400: '#FFB020',
    500: '#E09400',
    600: '#B67800',
    700: '#8C5C00',
    800: '#634000',
    900: '#3A2500',
  },
  neutral: {
    50: '#F7F9F8',
    100: '#ECEFEE',
    200: '#D8DDDB',
    300: '#B4BBB8',
    400: '#8A9491',
    500: '#616B68',
    600: '#48514E',
    700: '#323A37',
    800: '#1E2523',
    900: '#0F1513',
  },
} as const satisfies Record<string, Record<ColorStop, string>>;

/** Nomes de rampa disponiveis (derivado da fonte — nunca sai de sync). */
export type ColorName = keyof typeof colors;

/**
 * Branco puro. A rampa `neutral` comeca em `neutral-50` (#F7F9F8), entao o branco
 * usado como fundo ou como texto sobre cor (design-system-components.md §1, §7,
 * §12…) precisa de token proprio — nunca hardcodar `#FFFFFF` no componente.
 */
export const white = '#FFFFFF';

/**
 * Preto puro — cor-base das sombras de elevacao (elevation.ts; design-system.md
 * §6). Fica FORA da rampa `neutral` (que vai so ate `neutral-900` #0F1513), entao
 * precisa de token proprio — nunca hardcodar `#000000` no componente.
 */
export const black = '#000000';

/** Ordem canonica dos stops — fonte unica para iterar (testes, geracao de tema). */
export const stops = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900,
] as const satisfies readonly ColorStop[];

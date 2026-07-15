import type { ThemeMode } from '@fitvo/brand-tokens';
import { colors, radius, space, white } from '@fitvo/brand-tokens';

/**
 * Logica de cor/dimensao do Select MOBILE (design-system-components.md §3 + dark
 * §21), SEM react-native — testavel sob vitest. O TRIGGER reusa o resolver do Input
 * (`resolveInputColors`, "mesmas regras do Input" do §3); aqui fica so o que e
 * proprio do dropdown: superficie do menu e cor dos itens.
 *
 * No touch nao ha hover nem foco de teclado: o "hover" e o "foco (teclado)" do §3
 * colapsam no estado `pressed`. Dark: o menu e superficie "raised" (§3 =
 * `surfaceRaised`: branco / `neutral-800`; espelha o token, como o input-variants
 * espelha o §21); item pressionado sobe um stop no dark (`neutral-700`, regra §21).
 * Marca/perigo sao agnosticos de tema.
 */
/** Item minimo para filtragem (o componente passa suas proprias options). */
export interface FilterableOption {
  readonly label: string;
}

/**
 * Filtra por substring do rotulo (case-insensitive) — logica de busca do modo
 * `searchable` (combobox). Query vazia devolve a lista inteira. Pura/testavel,
 * compartilhada pela web via reimplementacao identica (pacotes separados).
 */
export function filterOptions<T extends FilterableOption>(
  options: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter((o) => o.label.toLowerCase().includes(q));
}

export const SELECT_MENU_DIMS = {
  borderRadius: radius.md, // 12 (§3)
  borderWidth: 1,
  padding: space[1], // 4 — respiro do menu ao redor dos itens
  itemPaddingV: space[2], // 8
  itemPaddingH: space[3], // 12
  itemRadius: radius.sm, // 8
} as const;

/** Superficie e borda do painel do menu (§3 + §21). */
export function resolveMenuColors(mode: ThemeMode): {
  readonly backgroundColor: string;
  readonly borderColor: string;
} {
  const dark = mode === 'dark';
  return {
    backgroundColor: dark ? colors.neutral[800] : white, // surfaceRaised
    borderColor: dark ? colors.neutral[700] : colors.neutral[200], // borderDefault
  };
}

/** Cores de texto resolvidas do tema, passadas pelo componente (como no Input). */
export interface SelectItemTextColors {
  readonly principal: string;
  readonly sutil: string;
}

export interface SelectItemColors {
  readonly backgroundColor: string;
  readonly textColor: string;
  /** `transparent` quando o item nao esta selecionado (nao mostra o check). */
  readonly checkColor: string;
}

/**
 * Cor de um item do menu (§3). Ordem de precedencia: disabled > selecionado >
 * pressed > normal. Selecionado usa `brand-50`/`brand-700` + check `brand-500`
 * (agnostico de tema); pressed = "hover" do doc (`neutral-100`, sobe p/ `neutral-700`
 * no dark).
 */
export function resolveSelectItemColors(
  mode: ThemeMode,
  selected: boolean,
  disabled: boolean,
  pressed: boolean,
  text: SelectItemTextColors,
): SelectItemColors {
  if (disabled) {
    return { backgroundColor: 'transparent', textColor: text.sutil, checkColor: 'transparent' };
  }
  if (selected) {
    return {
      backgroundColor: colors.brand[50],
      textColor: colors.brand[700],
      checkColor: colors.brand[500],
    };
  }
  if (pressed) {
    const dark = mode === 'dark';
    return {
      backgroundColor: dark ? colors.neutral[700] : colors.neutral[100],
      textColor: text.principal,
      checkColor: 'transparent',
    };
  }
  return { backgroundColor: 'transparent', textColor: text.principal, checkColor: 'transparent' };
}

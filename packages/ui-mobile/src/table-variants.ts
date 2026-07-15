import type { ThemeMode } from '@fitvo/brand-tokens';
import { colors, semanticColors } from '@fitvo/brand-tokens';

/**
 * Logica de cor da Tabela MOBILE (design-system-components.md §16), SEM
 * react-native — testavel sob vitest. No mobile a tabela e uma grade compacta com
 * rolagem horizontal (a paginacao numerada do §16 fica so no web — superficie de
 * painel admin).
 *
 * Estados (§16): cabecalho `neutral-50` fundo + `fg-muted`; linha `surface-raised`;
 * separador `neutral-100`; selecionada `brand-50`; celula `fg`. Sem hover no touch:
 * o hover `neutral-50` do §16 vira o `pressed`. Ordenacao ativa: `brand-500`.
 *
 * Inferencia dark (§16/§21 nao especificam a tabela): superficies/bordas neutras
 * seguem §21 "sobe na rampa" (cabecalho/pressed `neutral-800`, separador
 * `neutral-800`); selecionada `brand-50` agnostica de tema. Registrada.
 */
export interface TableRowColors {
  readonly backgroundColor: string;
  readonly textColor: string;
}

export function resolveTableHeaderColors(mode: ThemeMode): TableRowColors {
  // Cabecalho = superficie base (recessada): neutral-50 / neutral-900. Fica um degrau
  // ABAIXO das linhas (surfaceRaised), distinguindo-se nos dois temas.
  return {
    backgroundColor: semanticColors.surfaceBase[mode],
    textColor: semanticColors.textAuxiliar[mode],
  };
}

export function resolveTableRowColors(
  mode: ThemeMode,
  selected: boolean,
  pressed: boolean,
): TableRowColors {
  const textColor = semanticColors.textPrincipal[mode];
  if (selected) return { backgroundColor: colors.brand[50], textColor };
  if (pressed) {
    // No dark, as linhas ja sao neutral-800; o pressed sobe p/ neutral-700 (visivel).
    return {
      backgroundColor: mode === 'dark' ? colors.neutral[700] : colors.neutral[50],
      textColor,
    };
  }
  return { backgroundColor: semanticColors.surfaceRaised[mode], textColor };
}

export function tableSeparatorColor(mode: ThemeMode): string {
  // Separador sutil visivel sobre as linhas: neutral-100 no light, neutral-700 no dark.
  return mode === 'dark' ? colors.neutral[700] : colors.neutral[100];
}

/** Cor do icone de ordenacao (§16): ativo `brand-500`, inativo `textSutil`. */
export function tableSortIconColor(mode: ThemeMode, active: boolean): string {
  return active ? colors.brand[500] : semanticColors.textSutil[mode];
}

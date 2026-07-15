import type { ThemeMode } from '@fitvo/brand-tokens';
import { colors, white } from '@fitvo/brand-tokens';

/**
 * Logica de cor de Checkbox e Radio MOBILE (§4/§5), SEM react-native — testavel
 * sob vitest. No touch nao ha hover: o "hover" do doc (brand-50/brand-400) vira o
 * `pressed`. Dark nao e especificado no §4/§5: aplico a regra "sobe na rampa" do
 * §21 aos neutros; marca/perigo sao agnosticos de tema.
 */
export interface CheckboxColors {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly markColor: string;
}

export interface RadioColors {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly dotColor: string;
}

/** `active` = marcado OU indeterminado (mesma aparencia de fundo/borda). */
export function resolveCheckboxColors(
  mode: ThemeMode,
  active: boolean,
  disabled: boolean,
  error: boolean,
  pressed: boolean,
): CheckboxColors {
  const dark = mode === 'dark';
  if (disabled) {
    return active
      ? {
          backgroundColor: dark ? colors.neutral[600] : colors.neutral[300],
          borderColor: dark ? colors.neutral[600] : colors.neutral[300],
          markColor: colors.neutral[50],
        }
      : {
          backgroundColor: dark ? colors.neutral[800] : colors.neutral[100],
          borderColor: dark ? colors.neutral[700] : colors.neutral[200],
          markColor: 'transparent',
        };
  }
  if (active) {
    const stop = pressed ? colors.brand[600] : colors.brand[500];
    return { backgroundColor: stop, borderColor: stop, markColor: white };
  }
  if (error)
    return {
      backgroundColor: 'transparent',
      borderColor: colors.danger[400],
      markColor: 'transparent',
    };
  return {
    backgroundColor: pressed ? colors.brand[50] : 'transparent',
    borderColor: pressed ? colors.brand[400] : dark ? colors.neutral[600] : colors.neutral[300],
    markColor: 'transparent',
  };
}

export function resolveRadioColors(
  mode: ThemeMode,
  selected: boolean,
  disabled: boolean,
  error: boolean,
  pressed: boolean,
): RadioColors {
  const dark = mode === 'dark';
  if (disabled) {
    return selected
      ? {
          backgroundColor: 'transparent',
          borderColor: dark ? colors.neutral[600] : colors.neutral[300],
          dotColor: dark ? colors.neutral[600] : colors.neutral[300],
        }
      : {
          backgroundColor: dark ? colors.neutral[800] : colors.neutral[100],
          borderColor: dark ? colors.neutral[700] : colors.neutral[200],
          dotColor: 'transparent',
        };
  }
  if (selected) {
    return {
      backgroundColor: dark ? colors.neutral[900] : white,
      borderColor: colors.brand[500],
      dotColor: colors.brand[500],
    };
  }
  if (error)
    return {
      backgroundColor: 'transparent',
      borderColor: colors.danger[400],
      dotColor: 'transparent',
    };
  return {
    backgroundColor: pressed ? colors.brand[50] : 'transparent',
    borderColor: pressed ? colors.brand[400] : dark ? colors.neutral[600] : colors.neutral[300],
    dotColor: 'transparent',
  };
}

export interface SwitchColors {
  readonly trackColor: string;
  readonly thumbColor: string;
}

/**
 * Cores do Switch (§6). Trilho neutro quando desligado (sobe na rampa no dark),
 * `brand-500` quando ligado; botao branco. Sem hover no touch. Disabled esmaece
 * trilho e botao (§6: neutral-200/brand-200 no trilho, neutral-100/50 no botao).
 */
export function resolveSwitchColors(mode: ThemeMode, on: boolean, disabled: boolean): SwitchColors {
  const dark = mode === 'dark';
  if (disabled) {
    return on
      ? { trackColor: colors.brand[200], thumbColor: colors.neutral[50] }
      : {
          trackColor: dark ? colors.neutral[700] : colors.neutral[200],
          thumbColor: dark ? colors.neutral[800] : colors.neutral[100],
        };
  }
  return on
    ? { trackColor: colors.brand[500], thumbColor: white }
    : { trackColor: dark ? colors.neutral[600] : colors.neutral[300], thumbColor: white };
}

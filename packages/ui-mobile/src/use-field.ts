import { useState } from 'react';
import type { NativeSyntheticEvent, TextInputFocusEventData } from 'react-native';

import type { InputStateColors, InputStatus } from './input-variants';
import { resolveInputColors } from './input-variants';
import { useTheme } from './theme-context';

type FocusHandler = (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;

export interface FieldColorsResult {
  readonly colors: InputStateColors;
  readonly editable: boolean;
  readonly onFocus: FocusHandler;
  readonly onBlur: FocusHandler;
}

/**
 * Estado + cores compartilhados por Input e Textarea MOBILE. Le o tema, guarda o
 * foco (runtime) e resolve as cores por `input-variants.ts`. Centraliza a fiacao
 * para os dois campos nao divergirem.
 */
export function useFieldColors(
  status: InputStatus,
  disabled: boolean,
  readOnly: boolean,
  onFocusProp?: FocusHandler,
  onBlurProp?: FocusHandler,
): FieldColorsResult {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const colors = resolveInputColors(theme.mode, status, focused, disabled, readOnly, {
    principal: theme.colors.textPrincipal,
    auxiliar: theme.colors.textAuxiliar,
    sutil: theme.colors.textSutil,
  });

  return {
    colors,
    editable: !disabled && !readOnly,
    onFocus: (e): void => {
      setFocused(true);
      onFocusProp?.(e);
    },
    onBlur: (e): void => {
      setFocused(false);
      onBlurProp?.(e);
    },
  };
}

import { fontFamily, fontWeight } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type {
  NativeSyntheticEvent,
  TextInputFocusEventData,
  TextInputProps,
  TextStyle,
} from 'react-native';
import { StyleSheet, TextInput } from 'react-native';

import type { InputStatus } from './input-variants';
import { INPUT_DIMS, resolveInputColors } from './input-variants';
import { useTheme } from './theme-context';

export type { InputStatus } from './input-variants';

/**
 * Input MOBILE (design-system-components.md §2 + dark §21). TextInput com toda a
 * decisao de cor em `input-variants.ts` (testavel sem RN). Foco e estado de runtime
 * (onFocus/onBlur); no touch nao ha hover. disabled/readOnly desabilitam a edicao.
 */
export interface InputProps extends Omit<
  TextInputProps,
  'style' | 'editable' | 'placeholderTextColor'
> {
  readonly status?: InputStatus;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
}

const styles = StyleSheet.create({
  base: {
    height: INPUT_DIMS.height,
    paddingHorizontal: INPUT_DIMS.paddingHorizontal,
    borderRadius: INPUT_DIMS.borderRadius,
    borderWidth: INPUT_DIMS.borderWidth,
    fontFamily: fontFamily.body,
    fontWeight: String(fontWeight.regular) as TextStyle['fontWeight'],
    fontSize: INPUT_DIMS.fontSize,
  },
});

export function Input({
  status = 'default',
  disabled = false,
  readOnly = false,
  onFocus,
  onBlur,
  ...props
}: InputProps): ReactNode {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const c = resolveInputColors(theme.mode, status, focused, disabled, readOnly, {
    principal: theme.colors.textPrincipal,
    auxiliar: theme.colors.textAuxiliar,
    sutil: theme.colors.textSutil,
  });

  return (
    <TextInput
      editable={!disabled && !readOnly}
      placeholderTextColor={c.placeholderColor}
      accessibilityState={{ disabled }}
      onFocus={(e: NativeSyntheticEvent<TextInputFocusEventData>): void => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e: NativeSyntheticEvent<TextInputFocusEventData>): void => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.base,
        { backgroundColor: c.backgroundColor, borderColor: c.borderColor, color: c.color },
      ]}
      {...props}
    />
  );
}

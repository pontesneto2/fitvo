import { fontFamily, fontWeight } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import type { TextInputProps, TextStyle } from 'react-native';
import { StyleSheet, TextInput } from 'react-native';

import type { InputStatus } from './input-variants';
import { INPUT_DIMS } from './input-variants';
import { useFieldColors } from './use-field';

export type { InputStatus } from './input-variants';

/**
 * Input MOBILE (design-system-components.md §2 + dark §21). TextInput de linha
 * unica; a decisao de cor/estado vive em `input-variants.ts` + `useFieldColors`
 * (compartilhado com Textarea). No touch nao ha hover; foco e runtime.
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
  const {
    colors,
    editable,
    onFocus: handleFocus,
    onBlur: handleBlur,
  } = useFieldColors(status, disabled, readOnly, onFocus, onBlur);

  return (
    <TextInput
      editable={editable}
      placeholderTextColor={colors.placeholderColor}
      accessibilityState={{ disabled }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={[
        styles.base,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          color: colors.color,
        },
      ]}
      {...props}
    />
  );
}

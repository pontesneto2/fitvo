import { fontFamily, fontWeight, space } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import type { TextInputProps, TextStyle } from 'react-native';
import { StyleSheet, TextInput } from 'react-native';

import type { InputStatus } from './input-variants';
import { INPUT_DIMS } from './input-variants';
import { useFieldColors } from './use-field';

export type { InputStatus } from './input-variants';

/**
 * Textarea MOBILE (design-system-components.md §2). TextInput multilinha — mesmos
 * tokens de estado do Input (via `useFieldColors`), com altura minima de 80px,
 * padding vertical e texto alinhado ao topo.
 */
export interface TextareaProps extends Omit<
  TextInputProps,
  'style' | 'editable' | 'placeholderTextColor' | 'multiline'
> {
  readonly status?: InputStatus;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
}

const MIN_HEIGHT = 80;

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_HEIGHT,
    paddingHorizontal: INPUT_DIMS.paddingHorizontal,
    paddingVertical: space[2],
    borderRadius: INPUT_DIMS.borderRadius,
    borderWidth: INPUT_DIMS.borderWidth,
    fontFamily: fontFamily.body,
    fontWeight: String(fontWeight.regular) as TextStyle['fontWeight'],
    fontSize: INPUT_DIMS.fontSize,
    textAlignVertical: 'top',
  },
});

export function Textarea({
  status = 'default',
  disabled = false,
  readOnly = false,
  onFocus,
  onBlur,
  ...props
}: TextareaProps): ReactNode {
  const {
    colors,
    editable,
    onFocus: handleFocus,
    onBlur: handleBlur,
  } = useFieldColors(status, disabled, readOnly, onFocus, onBlur);

  return (
    <TextInput
      multiline
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

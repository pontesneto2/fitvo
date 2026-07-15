import { colors as ramp, fontFamily, fontSize, fontWeight, space } from '@fitvo/brand-tokens';
import type { ReactElement, ReactNode } from 'react';
import { cloneElement } from 'react';
import type { TextStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from './theme-context';

/**
 * Field MOBILE (design-system-components.md §2). Compoe rotulo + controle + ajuda/
 * erro. Quando ha `error`, injeta `status="error"` no controle (Input/Textarea) e
 * liga a acessibilidade (`accessibilityLabel`/`accessibilityHint`) — RN nao tem
 * aria/`htmlFor`. Rotulo Inter 14/500 (textAuxiliar); ajuda/erro Inter 12/400.
 */
export interface FieldProps {
  readonly label?: string;
  readonly description?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly children: ReactElement;
}

const styles = StyleSheet.create({
  root: { gap: space[2] },
  messages: { gap: space[1] },
  label: {
    fontFamily: fontFamily.body,
    fontWeight: String(fontWeight.medium) as TextStyle['fontWeight'],
    fontSize: fontSize.small,
  },
  message: {
    fontFamily: fontFamily.body,
    fontWeight: String(fontWeight.regular) as TextStyle['fontWeight'],
    fontSize: fontSize.caption,
  },
});

export function Field({
  label,
  description,
  error,
  required = false,
  children,
}: FieldProps): ReactNode {
  const theme = useTheme();
  const hasError = error !== undefined && error !== '';

  const injected: Record<string, unknown> = {};
  if (hasError) injected['status'] = 'error';
  if (label) injected['accessibilityLabel'] = label;
  const hint = error ?? description;
  if (hint) injected['accessibilityHint'] = hint;
  const control = Object.keys(injected).length > 0 ? cloneElement(children, injected) : children;

  const errorColor = theme.mode === 'dark' ? ramp.danger[400] : ramp.danger[700];

  return (
    <View style={styles.root}>
      {label ? (
        <Text style={[styles.label, { color: theme.colors.textAuxiliar }]}>
          {label}
          {required ? <Text style={{ color: ramp.danger[500] }}> *</Text> : null}
        </Text>
      ) : null}
      <View style={styles.messages}>
        {control}
        {hasError ? (
          <Text style={[styles.message, { color: errorColor }]}>{error}</Text>
        ) : description ? (
          <Text style={[styles.message, { color: theme.colors.textSutil }]}>{description}</Text>
        ) : null}
      </View>
    </View>
  );
}

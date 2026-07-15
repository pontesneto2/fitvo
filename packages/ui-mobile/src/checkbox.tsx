import { fontFamily, fontSize, radius } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from './theme-context';
import { resolveCheckboxColors } from './toggle-variants';

/**
 * Checkbox MOBILE (design-system-components.md §4). 20px, raio `sm`. Sem checkbox
 * nativo no RN: Pressable + View. Controlavel (usa `checked` se dado, senao estado
 * interno). No touch nao ha hover — o "hover" do doc vira `pressed`. Cores em
 * `toggle-variants.ts` (testavel sem RN); check/dash desenhados com View.
 */
export interface CheckboxProps {
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly indeterminate?: boolean;
  readonly disabled?: boolean;
  readonly error?: boolean;
  readonly onValueChange?: (checked: boolean) => void;
  readonly children?: ReactNode;
}

const SIZE = 20;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 6,
    height: 11,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    marginTop: -2,
    transform: [{ rotate: '45deg' }],
  },
  dash: { width: 10, height: 2, borderRadius: 1 },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.small },
});

export function Checkbox({
  checked,
  defaultChecked,
  indeterminate = false,
  disabled = false,
  error = false,
  onValueChange,
  children,
}: CheckboxProps): ReactNode {
  const theme = useTheme();
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState<boolean>(defaultChecked ?? false);
  const isChecked = isControlled ? checked : internal;
  const active = isChecked || indeterminate;

  const toggle = (): void => {
    const next = !isChecked;
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <Pressable
      onPress={toggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: indeterminate ? 'mixed' : isChecked, disabled }}
      style={styles.row}
    >
      {({ pressed }): ReactNode => {
        const c = resolveCheckboxColors(theme.mode, active, disabled, error, pressed && !disabled);
        const boxStyle: StyleProp<ViewStyle> = [
          styles.box,
          { backgroundColor: c.backgroundColor, borderColor: c.borderColor },
        ];
        return (
          <>
            <View style={boxStyle}>
              {indeterminate ? (
                <View style={[styles.dash, { backgroundColor: c.markColor }]} />
              ) : isChecked ? (
                <View style={[styles.check, { borderColor: c.markColor }]} />
              ) : null}
            </View>
            {children != null ? (
              <Text
                style={[
                  styles.label,
                  { color: disabled ? theme.colors.textSutil : theme.colors.textPrincipal },
                ]}
              >
                {children}
              </Text>
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
}

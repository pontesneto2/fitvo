import { fontFamily, fontSize } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from './theme-context';
import { resolveRadioColors } from './toggle-variants';

/**
 * Radio MOBILE (design-system-components.md §5). 20px, circular; ponto central.
 * Sem radio nativo no RN: o agrupamento e responsabilidade do pai (controlado por
 * `selected` + `onSelect`). No touch nao ha hover — vira `pressed`. Cores em
 * `toggle-variants.ts` (testavel sem RN).
 */
export interface RadioProps {
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly error?: boolean;
  readonly onSelect?: () => void;
  readonly children?: ReactNode;
}

const SIZE = 20;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.small },
});

export function Radio({
  selected = false,
  disabled = false,
  error = false,
  onSelect,
  children,
}: RadioProps): ReactNode {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={styles.row}
    >
      {({ pressed }): ReactNode => {
        const c = resolveRadioColors(theme.mode, selected, disabled, error, pressed && !disabled);
        const boxStyle: StyleProp<ViewStyle> = [
          styles.box,
          { backgroundColor: c.backgroundColor, borderColor: c.borderColor },
        ];
        return (
          <>
            <View style={boxStyle}>
              {selected ? <View style={[styles.dot, { backgroundColor: c.dotColor }]} /> : null}
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

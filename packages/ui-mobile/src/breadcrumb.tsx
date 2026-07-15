import { fontFamily, fontSize, fontWeight, space } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { crumbSeparatorColor, resolveCrumbColor } from './breadcrumb-variants';
import { useTheme } from './theme-context';

/**
 * Breadcrumb MOBILE (design-system-components.md §11). Trilha hierarquica. Cores em
 * `breadcrumb-variants.ts` (testavel sem RN). Sem hover no touch — o hover do §11
 * vira o `pressed` (`brand-600`). O ultimo item e o atual (sem toque, peso 500).
 */
export interface Crumb {
  readonly label: string;
  readonly onPress?: () => void;
}

export interface BreadcrumbProps {
  readonly items: readonly Crumb[];
  readonly style?: StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.small },
  current: { fontWeight: String(fontWeight.medium) as '500' },
  sep: { fontFamily: fontFamily.body, fontSize: fontSize.small },
});

export function Breadcrumb({ items, style }: BreadcrumbProps): ReactNode {
  const theme = useTheme();
  const sepColor = crumbSeparatorColor(theme.mode);

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel="Trilha de navegação"
      style={[styles.row, style]}
    >
      {items.map((item, i): ReactNode => {
        const isLast = i === items.length - 1;
        return (
          <View key={`${item.label}-${i}`} style={styles.row}>
            {isLast || item.onPress == null ? (
              <Text
                accessibilityRole={isLast ? 'header' : undefined}
                style={[
                  styles.label,
                  isLast && styles.current,
                  { color: resolveCrumbColor(theme.mode, isLast, false) },
                ]}
              >
                {item.label}
              </Text>
            ) : (
              <Pressable onPress={item.onPress} accessibilityRole="link">
                {({ pressed }): ReactNode => (
                  <Text
                    style={[styles.label, { color: resolveCrumbColor(theme.mode, false, pressed) }]}
                  >
                    {item.label}
                  </Text>
                )}
              </Pressable>
            )}
            {isLast ? null : (
              <Text style={[styles.sep, { color: sepColor }]} accessibilityElementsHidden>
                /
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

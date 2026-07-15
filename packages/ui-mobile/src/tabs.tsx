import { duration, easing, fontFamily, fontSize, fontWeight, space } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import type { TabsAccent } from './tabs-variants';
import { resolveTabColors, tabIndicatorColor } from './tabs-variants';
import { useTheme } from './theme-context';

/**
 * Tabs MOBILE (design-system-components.md §9). Indicador 2px DESLIZANTE que anima
 * (posicao + largura) entre as abas ao trocar de selecao (`duration-normal`/
 * `ease-standard`). Sem hover no touch — o "hover" do §9 vira o `pressed`. Cores em
 * `tabs-variants.ts` (testavel sem RN).
 *
 * Acento por ambiente (§9 + design-system.md §7). Controlavel (usa `value` se dado,
 * senao estado interno). A11y: cada aba e um `Pressable` com `accessibilityRole
 * ="tab"` e `accessibilityState.selected`.
 */
export interface TabItem {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly accent?: TabsAccent;
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', gap: space[1], borderBottomWidth: 1 },
  tab: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  label: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    fontWeight: String(fontWeight.medium) as '500',
  },
  indicator: { position: 'absolute', bottom: -1, height: 2, borderRadius: 999 },
});

interface Rect {
  readonly x: number;
  readonly width: number;
}

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  accent = 'brand',
}: TabsProps): ReactNode {
  const theme = useTheme();
  const isControlled = value !== undefined;
  const firstEnabled = items.find((i) => !i.disabled)?.value;
  const [internal, setInternal] = useState<string | undefined>(defaultValue ?? firstEnabled);
  const active = isControlled ? value : internal;

  const [rects, setRects] = useState<Record<string, Rect>>({});
  const left = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(0)).current;

  const activeRect = active != null ? rects[active] : undefined;
  useEffect(() => {
    if (!activeRect) return;
    const ease = Easing.bezier(
      easing.standard[0],
      easing.standard[1],
      easing.standard[2],
      easing.standard[3],
    );
    Animated.parallel([
      Animated.timing(left, {
        toValue: activeRect.x,
        duration: duration.normal,
        easing: ease,
        useNativeDriver: false,
      }),
      Animated.timing(width, {
        toValue: activeRect.width,
        duration: duration.normal,
        easing: ease,
        useNativeDriver: false,
      }),
    ]).start();
  }, [activeRect, left, width]);

  const select = (val: string): void => {
    if (!isControlled) setInternal(val);
    onValueChange?.(val);
  };

  const onTabLayout =
    (val: string) =>
    (e: LayoutChangeEvent): void => {
      const { x, width: w } = e.nativeEvent.layout;
      setRects((prev) =>
        prev[val]?.x === x && prev[val]?.width === w ? prev : { ...prev, [val]: { x, width: w } },
      );
    };

  return (
    <View style={[styles.list, { borderBottomColor: theme.colors.borderDefault }]}>
      {items.map((item): ReactNode => {
        const isActive = item.value === active;
        return (
          <Pressable
            key={item.value}
            onPress={() => !item.disabled && select(item.value)}
            onLayout={onTabLayout(item.value)}
            disabled={item.disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive, disabled: item.disabled ?? false }}
          >
            {({ pressed }): ReactNode => {
              const c = resolveTabColors(
                theme.mode,
                accent,
                isActive,
                item.disabled ?? false,
                pressed && !item.disabled,
              );
              return (
                <View style={[styles.tab, { backgroundColor: c.backgroundColor }]}>
                  <Text style={[styles.label, { color: c.textColor }]}>{item.label}</Text>
                </View>
              );
            }}
          </Pressable>
        );
      })}

      {activeRect ? (
        <Animated.View
          style={[styles.indicator, { left, width, backgroundColor: tabIndicatorColor(accent) }]}
        />
      ) : null}
    </View>
  );
}

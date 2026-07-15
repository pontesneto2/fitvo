import { fontFamily, fontSize, radius, space } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NAV_BAR_WIDTH, resolveNavItemColors } from './side-nav-variants';
import { useTheme } from './theme-context';

/**
 * Menu lateral / Navegacao MOBILE (design-system-components.md §10). Lista vertical
 * de itens. Cores em `side-nav-variants.ts` (testavel sem RN). Sem hover no touch —
 * o "hover" do §10 vira o `pressed`.
 *
 * Sempre `brand` (navegacao geral, nao usa acento de ambiente). O icone e um slot
 * (`renderIcon(color)` — o consumidor desenha com a cor de estado, ja que lucide
 * segue travado, §19). Controlavel (usa `value` se dado, senao estado interno).
 */
export interface NavItem {
  readonly value: string;
  readonly label: string;
  /** Desenha o icone com a cor do estado atual (texto/icone seguem §10). */
  readonly renderIcon?: (color: string) => ReactNode;
  readonly disabled?: boolean;
}

export interface SideNavProps {
  readonly items: readonly NavItem[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly style?: StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'column', gap: space[1] },
  item: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: space[1],
    bottom: space[1],
    width: NAV_BAR_WIDTH,
    borderRadius: 999,
  },
  label: { flexShrink: 1, fontFamily: fontFamily.body, fontSize: fontSize.small },
});

export function SideNav({
  items,
  value,
  defaultValue,
  onValueChange,
  style,
}: SideNavProps): ReactNode {
  const theme = useTheme();
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const active = isControlled ? value : internal;

  const select = (item: NavItem): void => {
    if (item.disabled) return;
    if (!isControlled) setInternal(item.value);
    onValueChange?.(item.value);
  };

  return (
    <View style={[styles.nav, style]}>
      {items.map((item): ReactNode => {
        const isActive = item.value === active;
        return (
          <Pressable
            key={item.value}
            onPress={() => select(item)}
            disabled={item.disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled: item.disabled ?? false }}
          >
            {({ pressed }): ReactNode => {
              const c = resolveNavItemColors(
                theme.mode,
                isActive,
                item.disabled ?? false,
                pressed && !item.disabled,
              );
              return (
                <View style={[styles.item, { backgroundColor: c.backgroundColor }]}>
                  {isActive ? <View style={[styles.bar, { backgroundColor: c.barColor }]} /> : null}
                  {item.renderIcon != null ? item.renderIcon(c.iconColor) : null}
                  <Text numberOfLines={1} style={[styles.label, { color: c.textColor }]}>
                    {item.label}
                  </Text>
                </View>
              );
            }}
          </Pressable>
        );
      })}
    </View>
  );
}

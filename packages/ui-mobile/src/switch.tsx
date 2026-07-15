import {
  duration,
  easing,
  fontFamily,
  fontSize,
  shadows,
  shadowToNative,
} from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from './theme-context';
import { resolveSwitchColors } from './toggle-variants';

/**
 * Switch MOBILE (design-system-components.md §6). Trilho 44×24, botao 20, raio full.
 * Pressable + botao animado (translateX, `duration-fast`/`ease-standard`).
 * Controlavel (usa `value` se dado, senao estado interno). Cores em
 * `toggle-variants.ts` (testavel sem RN). Sem hover no touch.
 */
export interface SwitchProps {
  readonly value?: boolean;
  readonly defaultValue?: boolean;
  readonly disabled?: boolean;
  readonly onValueChange?: (value: boolean) => void;
  readonly children?: ReactNode;
}

const TRACK_W = 44;
const TRACK_H = 24;
const THUMB = 20;
const PAD = 2;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, justifyContent: 'center' },
  thumb: {
    position: 'absolute',
    top: PAD,
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    ...shadowToNative(shadows.subtle.light),
  },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.small },
});

export function Switch({
  value,
  defaultValue,
  disabled = false,
  onValueChange,
  children,
}: SwitchProps): ReactNode {
  const theme = useTheme();
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<boolean>(defaultValue ?? false);
  const on = isControlled ? value : internal;

  const anim = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: on ? 1 : 0,
      duration: duration.fast,
      easing: Easing.bezier(
        easing.standard[0],
        easing.standard[1],
        easing.standard[2],
        easing.standard[3],
      ),
      useNativeDriver: true,
    }).start();
  }, [on, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD, TRACK_W - THUMB - PAD],
  });
  const c = resolveSwitchColors(theme.mode, on, disabled);

  const toggle = (): void => {
    const next = !on;
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <Pressable
      onPress={toggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      style={styles.row}
    >
      <Animated.View style={[styles.track, { backgroundColor: c.trackColor }]}>
        <Animated.View
          style={[styles.thumb, { backgroundColor: c.thumbColor, transform: [{ translateX }] }]}
        />
      </Animated.View>
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
    </Pressable>
  );
}

import {
  duration,
  easing,
  fontFamily,
  fontSize,
  radius,
  shadows,
  shadowToNative,
  space,
} from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from './theme-context';
import { resolveTooltipColors } from './tooltip-variants';

/**
 * Tooltip MOBILE (design-system-components.md §14). No touch nao ha hover: a dica
 * aparece no PRESS LONGO do gatilho e some ao soltar (equivalente tatil do
 * hover/foco do web). Cores em `tooltip-variants.ts` (testavel sem RN).
 *
 * Visual: fundo/texto pelos tokens `tooltipSurface`/`tooltipText` (invertem por
 * tema), raio `sm`, padding `space-2`, sombra `subtle`, Inter 12/400. Fade + slide
 * 4px (`duration-fast`/`ease-out`). Balao ancorado acima do gatilho (`side="top"`)
 * ou abaixo (`bottom`). NUNCA e o unico meio de informacao essencial (§14).
 */
export type TooltipSide = 'top' | 'bottom';

export interface TooltipProps {
  readonly content: string;
  readonly side?: TooltipSide;
  readonly children: ReactNode;
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', alignSelf: 'flex-start' },
  // Faixa absoluta que abrange a largura do gatilho e centraliza o balao acima/abaixo.
  anchor: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bubble: {
    maxWidth: 240,
    borderRadius: radius.sm,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    ...shadowToNative(shadows.subtle.light),
  },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.caption },
});

export function Tooltip({
  content,
  side = 'top',
  children,
  accessibilityLabel,
  style,
}: TooltipProps): ReactNode {
  const theme = useTheme();
  const c = resolveTooltipColors(theme.mode);
  const [open, setOpen] = useState(false);

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: duration.fast,
      easing: Easing.bezier(easing.out[0], easing.out[1], easing.out[2], easing.out[3]),
      useNativeDriver: true,
    }).start();
  }, [open, anim]);

  const slide = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [side === 'top' ? 4 : -4, 0],
  });

  const anchorPosition: ViewStyle =
    side === 'top'
      ? { bottom: '100%', marginBottom: space[2] }
      : { top: '100%', marginTop: space[2] };

  return (
    <View style={[styles.wrapper, style]}>
      <Pressable
        onLongPress={() => setOpen(true)}
        onPressOut={() => setOpen(false)}
        delayLongPress={400}
        accessibilityLabel={accessibilityLabel ?? content}
        accessibilityHint={content}
      >
        {children}
      </Pressable>
      {open ? (
        <View pointerEvents="none" style={[styles.anchor, anchorPosition]}>
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.bubble,
              {
                backgroundColor: c.backgroundColor,
                opacity: anim,
                transform: [{ translateY: slide }],
              },
            ]}
          >
            <Text style={[styles.label, { color: c.textColor }]}>{content}</Text>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

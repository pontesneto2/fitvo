import { fontFamily, fontWeight, radius, space } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import type { PressableProps, TextStyle, ViewStyle } from 'react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ButtonSize, ButtonVariant } from './button-variants';
import { resolveColors, SIZES } from './button-variants';
import { useTheme } from './theme-context';

export type { ButtonSize, ButtonVariant } from './button-variants';

/**
 * Button MOBILE (design-system-components.md §1). Renderiza com Pressable +
 * StyleSheet; toda a decisao de cor vive em `button-variants.ts` (testavel sem RN).
 * No touch nao ha hover: o "ativo" do doc vira o `pressed` do Pressable; foco/anel
 * sao conceitos de teclado (web).
 */
export interface ButtonProps extends Omit<PressableProps, 'children' | 'style' | 'disabled'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  /** Rotulo do botao (texto). */
  readonly children?: ReactNode;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    borderRadius: radius.md,
  },
  label: {
    fontFamily: fontFamily.body,
    fontWeight: String(fontWeight.medium) as TextStyle['fontWeight'],
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  ...props
}: ButtonProps): ReactNode {
  const theme = useTheme();
  const dims = SIZES[size];
  const isBlocked = disabled || loading;

  return (
    <Pressable
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={({ pressed }): ViewStyle => {
        const c = resolveColors(variant, pressed && !isBlocked, disabled, theme.colors.textSutil);
        return {
          ...styles.base,
          height: dims.height,
          paddingHorizontal: dims.paddingHorizontal,
          backgroundColor: c.backgroundColor,
          borderColor: c.borderColor,
          borderWidth: c.borderWidth,
        };
      }}
      {...props}
    >
      {({ pressed }): ReactNode => {
        const c = resolveColors(variant, pressed && !isBlocked, disabled, theme.colors.textSutil);
        return (
          <>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { fontSize: dims.fontSize, color: c.color, opacity: loading ? 0 : 1 },
              ]}
            >
              {children}
            </Text>
            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={c.color} />
              </View>
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
}

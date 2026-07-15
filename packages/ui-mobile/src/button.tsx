import {
  colors,
  controlHeight,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  space,
  white,
} from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import type { PressableProps, TextStyle, ViewStyle } from 'react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from './theme-context';

/**
 * Button MOBILE (design-system-components.md §1). Consome os tokens de
 * @fitvo/brand-tokens — zero hardcode. No touch nao ha hover: o estado "ativo" do
 * doc vira o `pressed` do Pressable; foco/anel sao conceitos de teclado (web). O
 * unico valor dependente de tema e o texto disabled (`textSutil`), lido do
 * ThemeProvider; as rampas brand/energy/danger sao agnosticas de tema (§8).
 */
export type ButtonVariant = 'primary' | 'energy' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style' | 'disabled'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  /** Rotulo do botao (texto). */
  readonly children?: ReactNode;
}

interface VariantColors {
  readonly backgroundColor: string;
  readonly color: string;
  readonly borderColor: string;
  readonly borderWidth: number;
}

const SIZES: Record<
  ButtonSize,
  { readonly height: number; readonly paddingHorizontal: number; readonly fontSize: number }
> = {
  sm: { height: controlHeight.sm, paddingHorizontal: space[3], fontSize: fontSize.small },
  md: { height: controlHeight.md, paddingHorizontal: space[4], fontSize: fontSize.small },
  lg: { height: controlHeight.lg, paddingHorizontal: space[6], fontSize: fontSize.body },
};

/** Cores por variante/estado (§1). `pressed` = o "ativo" do doc; sem hover no touch. */
function resolveColors(
  variant: ButtonVariant,
  pressed: boolean,
  disabled: boolean,
  disabledFg: string,
): VariantColors {
  const outlineBorder = { borderWidth: 1 } as const;
  switch (variant) {
    case 'primary':
      if (disabled)
        return {
          backgroundColor: colors.neutral[200],
          color: disabledFg,
          borderColor: 'transparent',
          borderWidth: 0,
        };
      return {
        backgroundColor: pressed ? colors.brand[700] : colors.brand[500],
        color: white,
        borderColor: 'transparent',
        borderWidth: 0,
      };
    case 'energy':
      if (disabled)
        return {
          backgroundColor: colors.neutral[200],
          color: disabledFg,
          borderColor: 'transparent',
          borderWidth: 0,
        };
      return {
        backgroundColor: pressed ? colors.energy[600] : colors.energy[400],
        color: pressed ? white : colors.brand[900],
        borderColor: 'transparent',
        borderWidth: 0,
      };
    case 'secondary':
      if (disabled)
        return {
          backgroundColor: 'transparent',
          color: disabledFg,
          borderColor: colors.neutral[200],
          ...outlineBorder,
        };
      return {
        backgroundColor: pressed ? colors.brand[100] : 'transparent',
        color: pressed ? colors.brand[800] : colors.brand[600],
        borderColor: pressed ? colors.brand[500] : colors.neutral[200],
        ...outlineBorder,
      };
    case 'ghost':
      if (disabled)
        return {
          backgroundColor: 'transparent',
          color: disabledFg,
          borderColor: 'transparent',
          borderWidth: 0,
        };
      return {
        backgroundColor: pressed ? colors.neutral[200] : 'transparent',
        color: pressed ? colors.brand[800] : colors.brand[600],
        borderColor: 'transparent',
        borderWidth: 0,
      };
    case 'destructive':
      if (disabled)
        return {
          backgroundColor: colors.neutral[200],
          color: disabledFg,
          borderColor: 'transparent',
          borderWidth: 0,
        };
      return {
        backgroundColor: pressed ? colors.danger[600] : colors.danger[400],
        color: white,
        borderColor: 'transparent',
        borderWidth: 0,
      };
  }
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

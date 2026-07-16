import {
  duration,
  fontFamily,
  fontSize,
  fontWeight,
  iconStroke,
  radius,
  space,
} from '@fitvo/brand-tokens';
import { AlertTriangle, Inbox } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Button } from './button';
import { emptyIconColor, errorIconColor, resolveSkeletonColors } from './states-variants';
import { useTheme } from './theme-context';

/**
 * Estados de tela MOBILE (design-system-components.md §15): Skeleton (loading),
 * EmptyState (vazio) e ErrorState (erro). Sucesso e via Toast (§13). EmptyState/
 * ErrorState compoem o `Button` (reuso). Cores em `states-variants.ts` (testavel
 * sem RN).
 */

// --- Skeleton ---

export type SkeletonVariant = 'text' | 'rect' | 'circle';

export interface SkeletonProps {
  readonly variant?: SkeletonVariant;
  readonly width?: DimensionValue;
  readonly height?: DimensionValue;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * Bloco de carregamento (§15): shimmer de COR `neutral-100`->`neutral-200` em loop
 * lento (`duration-slow`), via `Animated` (interpolacao de backgroundColor). Dark
 * sobe na rampa (§21). Nunca um spinner solto em tela cheia.
 */
export function Skeleton({ variant = 'rect', width, height, style }: SkeletonProps): ReactNode {
  const theme = useTheme();
  const shimmer = resolveSkeletonColors(theme.mode);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: duration.slow, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: duration.slow, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [shimmer.from, shimmer.to],
  });

  const shape: ViewStyle =
    variant === 'circle'
      ? { borderRadius: 999 }
      : variant === 'text'
        ? { height: 14, borderRadius: radius.sm }
        : { borderRadius: radius.md };

  return (
    <Animated.View
      accessibilityElementsHidden
      style={[
        shape,
        { backgroundColor },
        width != null && { width },
        height != null && { height },
        style,
      ]}
    />
  );
}

// --- Casca comum + icones ---

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    paddingHorizontal: space[6],
    paddingVertical: space[10],
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.body,
    fontWeight: String(fontWeight.medium) as '500',
    textAlign: 'center',
  },
  desc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    textAlign: 'center',
    maxWidth: 300,
  },
  actionSpacer: { marginTop: space[1] },
});

// --- EmptyState ---

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly action?: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  style,
}: EmptyStateProps): ReactNode {
  const theme = useTheme();
  return (
    <View style={[styles.shell, style]}>
      {icon ?? <Inbox size={44} strokeWidth={iconStroke} color={emptyIconColor} />}
      <Text style={[styles.title, { color: theme.colors.textPrincipal }]}>{title}</Text>
      {description ? (
        <Text style={[styles.desc, { color: theme.colors.textAuxiliar }]}>{description}</Text>
      ) : null}
      {action ? <View style={styles.actionSpacer}>{action}</View> : null}
    </View>
  );
}

// --- ErrorState ---

export interface ErrorStateProps {
  readonly title?: string;
  readonly message?: string;
  readonly icon?: ReactNode;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function ErrorState({
  title = 'Algo deu errado',
  message = 'Não foi possível carregar. Tente novamente em instantes.',
  icon,
  onRetry,
  retryLabel = 'Tentar novamente',
  style,
}: ErrorStateProps): ReactNode {
  const theme = useTheme();
  return (
    <View accessibilityRole="alert" style={[styles.shell, style]}>
      {icon ?? <AlertTriangle size={44} strokeWidth={iconStroke} color={errorIconColor} />}
      <Text style={[styles.title, { color: theme.colors.textPrincipal }]}>{title}</Text>
      {message ? (
        <Text style={[styles.desc, { color: theme.colors.textAuxiliar }]}>{message}</Text>
      ) : null}
      {onRetry ? (
        <View style={styles.actionSpacer}>
          <Button variant="secondary" size="sm" onPress={onRetry}>
            {retryLabel}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

import { shadows, shadowToNative } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CardColors, CardDensity, CardElevation, CardVariant } from './card-variants';
import { CARD_DIMS, resolveCardColors } from './card-variants';
import { useTheme } from './theme-context';

/**
 * Card MOBILE (design-system-components.md §7 + dark §21). Container de superficie.
 * Raio `lg`; padding por densidade (`compact` padrao mobile). Elevacao SEMANTICA
 * (flat por padrao; sombra so em `attention`). Cores/elevacao em `card-variants.ts`
 * (testavel sem RN).
 *
 * `interactive` -> Pressable (o "ativo" do §7 e o `pressed`; sem hover no touch);
 * demais variantes -> View. Marca (attention/selected) agnostica de tema.
 */
export interface CardProps {
  readonly variant?: CardVariant;
  /** Padding: `compact` (padrao mobile) = space-4; `comfortable` = space-6. */
  readonly density?: CardDensity;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
}

const styles = StyleSheet.create({
  base: { borderRadius: CARD_DIMS.borderRadius },
});

function elevationStyle(elevation: CardElevation): ViewStyle {
  if (elevation === 'flat') return {};
  return shadowToNative(shadows[elevation].light);
}

function cardStyle(
  c: CardColors,
  density: CardDensity,
  extra?: StyleProp<ViewStyle>,
): StyleProp<ViewStyle> {
  return [
    styles.base,
    {
      padding: density === 'compact' ? CARD_DIMS.paddingCompact : CARD_DIMS.paddingComfortable,
      backgroundColor: c.backgroundColor,
      borderColor: c.borderColor,
      borderWidth: c.borderWidth,
    },
    elevationStyle(c.elevation),
    extra,
  ];
}

export function Card({
  variant = 'default',
  density = 'compact',
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
  children,
}: CardProps): ReactNode {
  const theme = useTheme();

  if (variant === 'interactive') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
      >
        {({ pressed }): ReactNode => (
          <View
            style={cardStyle(
              resolveCardColors(theme.mode, 'interactive', pressed && !disabled),
              density,
              style,
            )}
          >
            {children}
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={cardStyle(resolveCardColors(theme.mode, variant, false), density, style)}
    >
      {children}
    </View>
  );
}

import { fontFamily, fontSize, fontWeight, space } from '@fitvo/brand-tokens';
import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BadgeVariant } from './badge-variants';
import { BADGE_DIMS, resolveBadgeColors } from './badge-variants';
import { Icon } from './icon';
import { useTheme } from './theme-context';

/**
 * Badge / Tag MOBILE (design-system-components.md §8). Chip de status/rotulo.
 * Altura 24, raio `full`, padding `space-2`, fonte Inter 12/500. Cores em
 * `badge-variants.ts` (testavel sem RN).
 *
 * Removivel (§8): `onRemove` adiciona um `×` tocavel que, pressionado, ganha fundo
 * no tom-200 da mesma rampa (equivalente touch do hover do web).
 */
export interface BadgeProps {
  readonly variant?: BadgeVariant;
  readonly onRemove?: () => void;
  readonly removeLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
}

const styles = StyleSheet.create({
  badge: {
    height: BADGE_DIMS.height,
    borderRadius: BADGE_DIMS.borderRadius,
    paddingHorizontal: BADGE_DIMS.paddingHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.caption,
    fontWeight: String(fontWeight.medium) as '500',
  },
  remove: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -space[1],
  },
});

export function Badge({
  variant = 'neutral',
  onRemove,
  removeLabel = 'Remover',
  style,
  children,
}: BadgeProps): ReactNode {
  const theme = useTheme();
  const c = resolveBadgeColors(theme.mode, variant);

  return (
    <View style={[styles.badge, { backgroundColor: c.backgroundColor }, style]}>
      {typeof children === 'string' ? (
        <Text style={[styles.label, { color: c.textColor }]}>{children}</Text>
      ) : (
        children
      )}
      {onRemove != null ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          hitSlop={8}
        >
          {({ pressed }): ReactNode => (
            <View style={[styles.remove, pressed ? { backgroundColor: c.removePressColor } : null]}>
              <Icon icon={X} size="sm" color={c.textColor} />
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

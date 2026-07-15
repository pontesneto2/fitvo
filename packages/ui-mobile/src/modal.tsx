import {
  duration,
  easing,
  fontFamily,
  fontSize,
  fontWeight,
  shadows,
  shadowToNative,
} from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  Animated,
  Easing,
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { ModalSize } from './modal-variants';
import { MODAL_DIMS, MODAL_MAX_WIDTH, modalScrim, resolveModalColors } from './modal-variants';
import { useTheme } from './theme-context';

/**
 * Modal / Dialog MOBILE (design-system-components.md §12). Usa o `Modal` nativo do
 * RN (que ja contem o foco de leitor de tela na camada). Veu `neutral-900` a 60%
 * (blur omitido — ver `modal-variants.ts`). Painel `surfaceRaised`, raio `lg`,
 * sombra `overlay`, padding `space-6`. Entrada fade + scale 0.96->1
 * (`duration-normal`/`ease-out`). Fecha por: toque no veu, botao de sistema
 * (`onRequestClose`) e × explicito. Titulo Poppins 18/600. Cores/dims em
 * `modal-variants.ts` (testavel sem RN).
 */
export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly size?: ModalSize;
  readonly showClose?: boolean;
  readonly closeLabel?: string;
  readonly accessibilityLabel?: string;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel: {
    width: '100%',
    borderRadius: MODAL_DIMS.borderRadius,
    padding: MODAL_DIMS.padding,
    ...shadowToNative(shadows.overlay.light),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  title: {
    flexShrink: 1,
    fontFamily: fontFamily.heading,
    fontSize: fontSize.h3,
    fontWeight: String(fontWeight.semibold) as '600',
  },
  body: { fontFamily: fontFamily.body, fontSize: fontSize.small },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  closeGlyph: { fontSize: 20, lineHeight: 22 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
});

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  showClose = true,
  closeLabel = 'Fechar',
  accessibilityLabel,
  children,
  footer,
  style,
}: ModalProps): ReactNode {
  const theme = useTheme();
  const c = resolveModalColors(theme.mode);

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: duration.normal,
      easing: Easing.bezier(easing.out[0], easing.out[1], easing.out[2], easing.out[3]),
      useNativeDriver: true,
    }).start();
  }, [open, anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.overlay, { backgroundColor: modalScrim.color }]}
        onPress={onClose}
        accessibilityLabel={accessibilityLabel}
      >
        <Animated.View style={{ opacity: anim, width: '100%', maxWidth: MODAL_MAX_WIDTH[size] }}>
          {/* Pressable "vazio" impede que o toque no painel feche o modal. */}
          <Pressable onPress={() => undefined}>
            <Animated.View
              accessibilityViewIsModal
              style={[
                styles.panel,
                { backgroundColor: c.backgroundColor, transform: [{ scale }] },
                style,
              ]}
            >
              {title || showClose ? (
                <View style={styles.header}>
                  {title ? (
                    <Text
                      accessibilityRole="header"
                      style={[styles.title, { color: c.titleColor }]}
                    >
                      {title}
                    </Text>
                  ) : (
                    <View />
                  )}
                  {showClose ? (
                    <Pressable
                      onPress={onClose}
                      accessibilityRole="button"
                      accessibilityLabel={closeLabel}
                      hitSlop={8}
                      style={styles.close}
                    >
                      <Text style={[styles.closeGlyph, { color: c.bodyColor }]}>×</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {typeof children === 'string' ? (
                <Text style={[styles.body, { color: c.bodyColor }]}>{children}</Text>
              ) : (
                children
              )}

              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </RNModal>
  );
}

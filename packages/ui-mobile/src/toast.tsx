import {
  colors,
  duration as durationTokens,
  easing,
  fontFamily,
  fontSize,
  fontWeight,
  radius,
  shadows,
  shadowToNative,
  space,
} from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ToastVariant } from './toast-variants';
import { resolveToastColors, resolveToastDuration } from './toast-variants';

/**
 * Toast / Notificacao MOBILE (design-system-components.md §13). Cartao
 * presentacional (`Toast`) + fila (`ToastProvider`/`useToast`). Cores/duracao em
 * `toast-variants.ts` (testavel sem RN).
 *
 * Visual: raio `md`, padding `space-4`, sombra `raised`, borda-esq 3px do acento.
 * Posicao: topo (mobile). Slide + fade (`duration-normal`/`ease-out`). Auto-dismiss
 * 5s; `error` fica manual. Titulo Inter 14/500, descricao Inter 13/400 — em tons
 * escuros fixos (agnostico de tema, ver `toast-variants.ts`). Icone desenhado por
 * glifo colorido (sem lucide, §19).
 */
const GLYPH: Record<ToastVariant, string> = {
  success: '✓',
  error: '!',
  warning: '!',
  info: 'i',
  achievement: '★',
};

export interface ToastData {
  readonly id: string;
  readonly variant?: ToastVariant;
  readonly title: string;
  readonly description?: string;
  readonly duration?: number | null;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    width: 320,
    maxWidth: '100%',
    borderRadius: radius.md,
    borderLeftWidth: 3,
    padding: space[4],
    ...shadowToNative(shadows.raised.light),
  },
  icon: { fontSize: 16, lineHeight: 20, fontWeight: '700', marginTop: 1 },
  body: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.small,
    fontWeight: String(fontWeight.medium) as '500',
  },
  desc: { fontFamily: fontFamily.body, fontSize: fontSize.footnote, marginTop: 2 },
  close: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
    marginRight: -2,
  },
  closeGlyph: { fontSize: 15, lineHeight: 16 },
  viewport: { position: 'absolute', top: space[4], left: space[4], right: space[4], gap: space[2] },
});

export interface ToastProps {
  readonly variant?: ToastVariant;
  readonly title: string;
  readonly description?: string;
  readonly onClose?: () => void;
  readonly closeLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** Cartao visual do toast (presentacional puro; sem timer). */
export function Toast({
  variant = 'info',
  title,
  description,
  onClose,
  closeLabel = 'Fechar',
  style,
}: ToastProps): ReactNode {
  const c = resolveToastColors(variant);
  return (
    <View
      accessibilityLiveRegion={variant === 'error' ? 'assertive' : 'polite'}
      style={[
        styles.card,
        { backgroundColor: c.backgroundColor, borderLeftColor: c.accentColor },
        style,
      ]}
    >
      <Text style={[styles.icon, { color: c.iconColor }]}>{GLYPH[variant]}</Text>
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.titleColor }]}>{title}</Text>
        {description ? (
          <Text style={[styles.desc, { color: c.descColor }]}>{description}</Text>
        ) : null}
      </View>
      {onClose ? (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={8}
          style={styles.close}
        >
          <Text style={[styles.closeGlyph, { color: colors.neutral[500] }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// --- Fila (provider + hook) ---

interface ToastContextValue {
  readonly toast: (data: Omit<ToastData, 'id'>) => string;
  readonly dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;
function nextId(): string {
  counter += 1;
  return `toast-${counter}`;
}

function ToastItem({
  data,
  onDismiss,
}: {
  readonly data: ToastData;
  readonly onDismiss: (id: string) => void;
}): ReactNode {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: durationTokens.normal,
      easing: Easing.bezier(easing.out[0], easing.out[1], easing.out[2], easing.out[3]),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const ms = resolveToastDuration(data.variant ?? 'info', data.duration);
  useEffect(() => {
    if (ms == null) return;
    const t = setTimeout(() => onDismiss(data.id), ms);
    return () => clearTimeout(t);
  }, [ms, data.id, onDismiss]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      <Toast
        title={data.title}
        onClose={() => onDismiss(data.id)}
        {...(data.variant ? { variant: data.variant } : {})}
        {...(data.description ? { description: data.description } : {})}
      />
    </Animated.View>
  );
}

export interface ToastProviderProps {
  readonly children: ReactNode;
}

/** Fornece `useToast()` e renderiza o viewport (topo). */
export function ToastProvider({ children }: ToastProviderProps): ReactNode {
  const [items, setItems] = useState<readonly ToastData[]>([]);
  const dismiss = useCallback((id: string): void => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const toast = useCallback((data: Omit<ToastData, 'id'>): string => {
    const id = nextId();
    setItems((prev) => [...prev, { ...data, id }]);
    return id;
  }, []);

  const valueRef = useRef<ToastContextValue>({ toast, dismiss });
  valueRef.current = { toast, dismiss };

  return (
    <ToastContext.Provider value={valueRef.current}>
      {children}
      <View pointerEvents="box-none" style={styles.viewport}>
        {items.map((t): ReactNode => (
          <ToastItem key={t.id} data={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

/** Empurra/remove toasts. Lanca se usado fora do `<ToastProvider>`. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error('useToast deve ser usado dentro de <ToastProvider>.');
  }
  return ctx;
}

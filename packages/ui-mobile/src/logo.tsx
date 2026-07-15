import { fontFamily, fontWeight } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { LOGO_ICON_COLORS, LOGO_WORDMARK_ASPECT } from './logo-variants';
import { useTheme } from './theme-context';

/**
 * Logo FITVO MOBILE (design-system.md §9 + components §20).
 *
 * - `wordmark`: arte oficial em PNG (raster). O APP passa a `source` via `require`
 *   das artes em `packages/brand-tokens/assets/logo/` (resolucao de asset em RN e
 *   do bundler do app — evita quebrar o typecheck do pacote com require de .png).
 *   Com `lightSource`+`darkSource`, escolhe pelo tema ativo. Cor FIXA na arte
 *   (raster nao segue tokens em runtime); as cores da arte = brand-500/energy-400/
 *   branco por valor (§9).
 * - `icon`: simbolo **PROVISORIO** (§20) — "V" `brand-500` com detalhe `energy-400`,
 *   desenhado (sem SVG/lucide no mobile). `TODO`: trocar pelo definitivo.
 *
 * `size` = ALTURA (dp); a largura acompanha a proporcao da arte.
 */
export type LogoVariant = 'wordmark' | 'icon';

export interface LogoProps {
  readonly variant?: LogoVariant;
  readonly size?: number;
  /** Fonte da arte (tema claro, ou unica). Ex.: require('.../logo-...-light.png'). */
  readonly lightSource?: ImageSourcePropType;
  /** Fonte da arte no tema escuro (opcional). */
  readonly darkSource?: ImageSourcePropType;
  readonly title?: string;
  readonly style?: StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  iconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  vLabel: { fontFamily: fontFamily.heading, fontWeight: String(fontWeight.semibold) as '600' },
  accent: { position: 'absolute', borderRadius: 999, backgroundColor: LOGO_ICON_COLORS.accent },
});

/** Símbolo provisório desenhado: "V" (brand-500) + ponto de energia (energy-400). */
function ProvisionalIcon({
  size,
  title,
}: {
  readonly size: number;
  readonly title: string;
}): ReactNode {
  const dot = Math.max(4, Math.round(size * 0.18));
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={title}
      style={[styles.iconWrap, { width: size, height: size }]}
    >
      <Text
        style={[
          styles.vLabel,
          { color: LOGO_ICON_COLORS.stroke, fontSize: Math.round(size * 0.82) },
        ]}
      >
        V
      </Text>
      <View
        style={[styles.accent, { width: dot, height: dot, top: size * 0.12, right: size * 0.14 }]}
      />
    </View>
  );
}

export function Logo({
  variant = 'wordmark',
  size = 32,
  lightSource,
  darkSource,
  title = 'FITVO',
  style,
}: LogoProps): ReactNode {
  const theme = useTheme();

  if (variant === 'icon') {
    return (
      <View style={style}>
        <ProvisionalIcon size={size} title={title} />
      </View>
    );
  }

  const source = theme.mode === 'dark' ? (darkSource ?? lightSource) : lightSource;
  if (source == null) return null; // sem arte fornecida pelo app

  return (
    <View style={style}>
      <Image
        accessibilityRole="image"
        accessibilityLabel={title}
        source={source}
        resizeMode="contain"
        style={{ height: size, width: size * LOGO_WORDMARK_ASPECT }}
      />
    </View>
  );
}

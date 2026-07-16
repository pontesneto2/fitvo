import type { ReactNode } from 'react';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { Image, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { LOGO_ICON_PROVISIONAL } from './logo-art';
import { LOGO_WORDMARK_ASPECT } from './logo-variants';
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
 * - `icon`: simbolo **PROVISORIO** (§20) — mesma arte SVG do `ui-web` (`logo-art.ts`),
 *   renderizada via `SvgXml` (`react-native-svg`, peer do pacote desde §19). Antes
 *   desenhava um "V" de texto como aproximacao; agora e o SVG real, igual a web.
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

/** Símbolo provisório: mesma arte SVG do `ui-web` (`logo-art.ts`), via `SvgXml`. */
function ProvisionalIcon({
  size,
  title,
}: {
  readonly size: number;
  readonly title: string;
}): ReactNode {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={title}
      style={{ width: size, height: size }}
    >
      <SvgXml xml={LOGO_ICON_PROVISIONAL} width={size} height={size} />
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

import { fontFamily, fontWeight } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { LogoSizeName } from './logo-variants';
import { markAccentSize, markDiameter, WORDMARK_COLORS, wordmarkFontSize } from './logo-variants';

/**
 * Logo MOBILE (design-system.md §9 / design-system-components.md §20 — o
 * simbolo final ainda [A DEFINIR]). Cobre o que ja esta fechado — wordmark
 * Poppins, "FIT" `brand-500` / "VO" `energy-400` — e expoe um mark
 * PROVISORIO (View geometrica, sem simbolo de marca) para nao deixar o slot
 * vazio. Logica em `logo-variants.ts` (testavel sem RN).
 */
export type { LogoSizeName };

export interface LogoProps {
  readonly size?: LogoSizeName;
  /** Oculta o mark geometrico provisorio, mostrando so o wordmark. */
  readonly showMark?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { fontFamily: fontFamily.heading, fontWeight: String(fontWeight.semibold) as '600' },
  mark: { position: 'relative' },
  markBase: { position: 'absolute', top: 0, left: 0, borderRadius: 6 },
  markAccent: { position: 'absolute', borderRadius: 3 },
});

function ProvisionalMark({ size }: { readonly size: LogoSizeName }): ReactNode {
  const box = markDiameter(size);
  const accent = markAccentSize(size);
  return (
    <View accessibilityElementsHidden style={[styles.mark, { width: box, height: box }]}>
      <View
        style={[styles.markBase, { width: box, height: box, backgroundColor: WORDMARK_COLORS.fit }]}
      />
      <View
        style={[
          styles.markAccent,
          {
            width: accent,
            height: accent,
            right: -box * 0.12,
            bottom: -box * 0.12,
            backgroundColor: WORDMARK_COLORS.vo,
          },
        ]}
      />
    </View>
  );
}

export function Logo({ size = 'md', showMark = true, style }: LogoProps): ReactNode {
  const textSize = wordmarkFontSize(size);
  return (
    <View accessibilityRole="text" accessibilityLabel="FITVO" style={[styles.row, style]}>
      {showMark ? <ProvisionalMark size={size} /> : null}
      <Text style={[styles.wordmark, { fontSize: textSize, color: WORDMARK_COLORS.fit }]}>
        FIT
        <Text style={{ color: WORDMARK_COLORS.vo }}>VO</Text>
      </Text>
    </View>
  );
}

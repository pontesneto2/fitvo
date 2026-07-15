import { fontFamily, fontWeight, white } from '@fitvo/brand-tokens';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { AvatarSizeName } from './avatar-variants';
import { AVATAR_FALLBACK, avatarDiameter, avatarFontSize, getInitials } from './avatar-variants';

/**
 * Avatar MOBILE (design-system-components.md §18). Foto do usuario com fallback de
 * iniciais. Tamanhos do token `avatarSize`; raio full; fallback `brand-100`/
 * `brand-700` Poppins 500; borda opcional 2px branca (grupos). Logica em
 * `avatar-variants.ts` (testavel sem RN). Se `source`/`uri` falhar, cai para as
 * iniciais de `name` (que tambem e o rotulo acessivel).
 */
export interface AvatarProps {
  readonly name: string;
  readonly uri?: string;
  readonly size?: AvatarSizeName;
  readonly bordered?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  border: { borderWidth: 2, borderColor: white },
  initials: { fontFamily: fontFamily.heading, fontWeight: String(fontWeight.medium) as '500' },
});

export function Avatar({
  name,
  uri,
  size = 'md',
  bordered = false,
  style,
}: AvatarProps): ReactNode {
  const [failed, setFailed] = useState(false);
  const diameter = avatarDiameter(size);
  const showImg = uri != null && uri !== '' && !failed;

  const shape: ViewStyle = {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
  };

  // Container sempre View (clipa em circulo). Quando ha imagem, ela preenche por
  // cima do fallback; se falhar, cai para as iniciais ja renderizadas atras.
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.base,
        shape,
        { backgroundColor: AVATAR_FALLBACK.backgroundColor },
        bordered && styles.border,
        style,
      ]}
    >
      <Text
        style={[
          styles.initials,
          { color: AVATAR_FALLBACK.textColor, fontSize: avatarFontSize(size) },
        ]}
      >
        {getInitials(name)}
      </Text>
      {showImg ? (
        <Image source={{ uri }} onError={() => setFailed(true)} style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  );
}

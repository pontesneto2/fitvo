import type { ThemeMode } from '@fitvo/brand-tokens';
import { colors, controlHeight, fontSize, radius, space, white } from '@fitvo/brand-tokens';

/**
 * Logica de estilo do Input MOBILE (§2 + dark §21), SEM react-native — testavel
 * sob vitest. Diferente do Button, as SUPERFICIES do input dependem do tema
 * (light neutral-50/white vs dark neutral-800/900), entao o `mode` entra aqui; as
 * cores de TEXTO ja vem resolvidas do ThemeProvider (textPrincipal/auxiliar/sutil).
 */
export type InputStatus = 'default' | 'error' | 'success';

export interface InputStateColors {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly color: string;
  readonly placeholderColor: string;
}

/** Cores de texto resolvidas do tema, passadas pelo componente. */
export interface InputTextColors {
  readonly principal: string;
  readonly auxiliar: string;
  readonly sutil: string;
}

export const INPUT_DIMS = {
  height: controlHeight.md, // 40 (§2)
  paddingHorizontal: space[3], // 12
  borderRadius: radius.sm, // 8
  fontSize: fontSize.small, // 14
  borderWidth: 1,
} as const;

// danger-900 (#380C0C) e energy-900 (#004321) a 20% — o "erro no dark" do §21.
const DANGER_TINT_DARK = 'rgba(56, 12, 12, 0.2)';

export function resolveInputColors(
  mode: ThemeMode,
  status: InputStatus,
  focused: boolean,
  disabled: boolean,
  readOnly: boolean,
  text: InputTextColors,
): InputStateColors {
  const dark = mode === 'dark';
  const inactive = disabled || readOnly;

  // Superficie base por interacao...
  let backgroundColor: string;
  if (inactive) backgroundColor = dark ? colors.neutral[800] : colors.neutral[100];
  else if (focused) backgroundColor = dark ? colors.neutral[900] : white;
  else backgroundColor = dark ? colors.neutral[800] : colors.neutral[50];

  // ...sobrescrita pelo status (light do §2; no dark, so o erro e especificado).
  if (status === 'error') backgroundColor = dark ? DANGER_TINT_DARK : colors.danger[50];
  else if (status === 'success' && !dark) backgroundColor = colors.energy[50];

  let borderColor: string;
  if (status === 'error') borderColor = colors.danger[400];
  else if (status === 'success') borderColor = colors.energy[500];
  else if (focused) borderColor = dark ? colors.brand[400] : colors.brand[500];
  else borderColor = dark ? colors.neutral[700] : colors.neutral[200];

  const color = disabled ? text.sutil : readOnly ? text.auxiliar : text.principal;

  return { backgroundColor, borderColor, color, placeholderColor: text.sutil };
}

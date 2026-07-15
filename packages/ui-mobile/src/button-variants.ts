import { colors, controlHeight, fontSize, space, white } from '@fitvo/brand-tokens';

/**
 * Logica de estilo do Button MOBILE (design-system-components.md §1), SEM
 * dependencia de react-native — para ser testavel sob vitest (node) e manter o
 * mapeamento variante/estado -> token isolado da renderizacao. `button.tsx` so
 * consome estas tabelas.
 */
export type ButtonVariant = 'primary' | 'energy' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface VariantColors {
  readonly backgroundColor: string;
  readonly color: string;
  readonly borderColor: string;
  readonly borderWidth: number;
}

export interface SizeDims {
  readonly height: number;
  readonly paddingHorizontal: number;
  readonly fontSize: number;
}

export const SIZES: Record<ButtonSize, SizeDims> = {
  sm: { height: controlHeight.sm, paddingHorizontal: space[3], fontSize: fontSize.small },
  md: { height: controlHeight.md, paddingHorizontal: space[4], fontSize: fontSize.small },
  lg: { height: controlHeight.lg, paddingHorizontal: space[6], fontSize: fontSize.body },
};

/**
 * Cores por variante/estado. `pressed` = o "ativo" do doc (no touch nao ha hover).
 * `disabledFg` vem do ThemeProvider (`textSutil`, unico valor dependente de tema);
 * as rampas brand/energy/danger sao agnosticas de tema (§8).
 */
export function resolveColors(
  variant: ButtonVariant,
  pressed: boolean,
  disabled: boolean,
  disabledFg: string,
): VariantColors {
  const outline = { borderWidth: 1 } as const;
  const solid = { borderColor: 'transparent', borderWidth: 0 } as const;
  switch (variant) {
    case 'primary':
      if (disabled) return { backgroundColor: colors.neutral[200], color: disabledFg, ...solid };
      return {
        backgroundColor: pressed ? colors.brand[700] : colors.brand[500],
        color: white,
        ...solid,
      };
    case 'energy':
      if (disabled) return { backgroundColor: colors.neutral[200], color: disabledFg, ...solid };
      return {
        backgroundColor: pressed ? colors.energy[600] : colors.energy[400],
        color: pressed ? white : colors.brand[900],
        ...solid,
      };
    case 'secondary':
      if (disabled)
        return {
          backgroundColor: 'transparent',
          color: disabledFg,
          borderColor: colors.neutral[200],
          ...outline,
        };
      return {
        backgroundColor: pressed ? colors.brand[100] : 'transparent',
        color: pressed ? colors.brand[800] : colors.brand[600],
        borderColor: pressed ? colors.brand[500] : colors.neutral[200],
        ...outline,
      };
    case 'ghost':
      if (disabled) return { backgroundColor: 'transparent', color: disabledFg, ...solid };
      return {
        backgroundColor: pressed ? colors.neutral[200] : 'transparent',
        color: pressed ? colors.brand[800] : colors.brand[600],
        ...solid,
      };
    case 'destructive':
      if (disabled) return { backgroundColor: colors.neutral[200], color: disabledFg, ...solid };
      return {
        backgroundColor: pressed ? colors.danger[600] : colors.danger[400],
        color: white,
        ...solid,
      };
  }
}

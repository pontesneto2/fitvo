import { colors } from '@fitvo/brand-tokens';

/**
 * Logica de cor do Toast MOBILE (design-system-components.md §13), SEM react-native —
 * testavel sob vitest.
 *
 * Variantes: success (energy) / error (danger) / warning / info (clinic) /
 * achievement (lime). Cada uma = fundo tom-50, acento (borda-esq 3px) tom-400/500,
 * icone tom-600.
 *
 * Inferencia dark (§13/§21 nao especificam): a superficie tingida e o acento sao
 * AGNOSTICOS de tema (como o Badge, §8); por isso titulo/descricao fixam os tons
 * ESCUROS (`neutral-900`/`neutral-600`) nos dois temas — o texto precisa ficar
 * legivel sobre a tinta clara mesmo no dark. Registrada.
 */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'achievement';

export interface ToastColors {
  readonly backgroundColor: string;
  /** Borda-esquerda 3px (§13). */
  readonly accentColor: string;
  readonly iconColor: string;
  readonly titleColor: string;
  readonly descColor: string;
}

const TITLE = colors.neutral[900];
const DESC = colors.neutral[600];

export function resolveToastColors(variant: ToastVariant): ToastColors {
  const base = { titleColor: TITLE, descColor: DESC };
  switch (variant) {
    case 'success':
      return {
        backgroundColor: colors.energy[50],
        accentColor: colors.energy[500],
        iconColor: colors.energy[600],
        ...base,
      };
    case 'error':
      return {
        backgroundColor: colors.danger[50],
        accentColor: colors.danger[400],
        iconColor: colors.danger[600],
        ...base,
      };
    case 'warning':
      return {
        backgroundColor: colors.warning[50],
        accentColor: colors.warning[400],
        iconColor: colors.warning[600],
        ...base,
      };
    case 'info':
      return {
        backgroundColor: colors.clinic[50],
        accentColor: colors.clinic[400],
        iconColor: colors.clinic[600],
        ...base,
      };
    case 'achievement':
      return {
        backgroundColor: colors.lime[50],
        accentColor: colors.lime[400],
        iconColor: colors.lime[600],
        ...base,
      };
  }
}

/** Duracao efetiva do auto-dismiss (ms). `error` fica manual (null). */
export function resolveToastDuration(
  variant: ToastVariant,
  duration: number | null | undefined,
): number | null {
  if (duration !== undefined) return duration;
  return variant === 'error' ? null : 5000;
}

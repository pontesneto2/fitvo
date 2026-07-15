import { colors } from './colors';
import { semanticColors } from './semantic-colors';

/**
 * Icones (design-system-components.md §19). Familia definida: LUCIDE
 * (`lucide-react` na web, `lucide-react-native` no mobile — mesma API, MIT). O
 * `iconStroke` de 1.5px e o padrao nativo da familia. Se a familia mudar um dia,
 * so o token muda, nunca o componente.
 */
export type IconSize = 'sm' | 'md' | 'lg';

/** Familia de icones adotada. */
export const iconFamily = 'lucide';

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
} as const satisfies Record<IconSize, number>;

/** Espessura do traco (stroke) do icone, em px. */
export const iconStroke = 1.5;

/**
 * Cores de icone: `default` = texto auxiliar (token semantico, resolve
 * light/dark); `active` = `brand-600` (stop fixo). Formas diferentes de proposito
 * — refletem o §19.
 */
export const iconColor = {
  default: semanticColors.textAuxiliar,
  active: colors.brand[600],
} as const;

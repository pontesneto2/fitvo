import type { ColorName } from './colors';
import { colors } from './colors';
import type { ColorRamp, Environment } from './types';

/**
 * Cor por ambiente/especialidade (design-system.md §7). Cor-mae (brand) e neutros
 * permanecem constantes em todos os ambientes; so o acento muda. O acento aponta
 * para um NOME de rampa (referencia, nao copia) -> integridade env -> rampa em
 * tempo de compilacao (um typo como `'limee'` vira erro de tipo).
 */
export const environments = {
  treino: { accent: 'lime' },
  nutricao: { accent: 'amber' },
  medicina: { accent: 'clinic' },
} as const satisfies Record<Environment, { readonly accent: ColorName }>;

/** Rampa de acento completa de um ambiente. */
export function accentRamp(env: Environment): ColorRamp {
  return colors[environments[env].accent];
}

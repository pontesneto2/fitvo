/**
 * De-para EQUIPAMENTO (free-exercise-db, inglês) → catálogo de equipamentos dos
 * contextos de treino (D-187 — ADR-0011).
 *
 * ⚠️ ESTADO: **mapeamento sem destino persistido, de propósito.**
 *
 * O D-187 está DECIDIDO no ADR-0011 mas ainda NÃO implementado — não existe
 * tabela nem enum de contexto/equipamento no schema, e `Exercise` não tem
 * coluna de equipamento (só o ADR-0018/D-158 a esboça). Duas consequências:
 *
 * 1. Os `code` abaixo são **provisórios**: transcrevem o catálogo do D-187 tal
 *    como escrito no ADR, mas quem manda quando o D-187 for implementado é a
 *    tabela que nascer lá. Como nada aqui é gravado em coluna, uma eventual
 *    divergência de código não corrompe dado nenhum — só o relatório do seed
 *    consome estes valores.
 * 2. O seed NÃO inventa coluna para guardar isto. Ele mapeia, conta e REPORTA.
 *    Ligar o equipamento ao `Exercise` é trabalho do momento em que D-187 e
 *    D-158 forem para o schema — ver `docs/pendencias-mesa.md`.
 *
 * `equipment` nulo na fonte (77 registros) significa "sem equipamento" e cai em
 * `NENHUM`, o mesmo destino de `body only` — peso corporal.
 */
export interface EquipmentMapping {
  /** Código provisório derivado do catálogo do D-187 (ADR-0011). */
  code: string;
  /** Rótulo pt-BR como escrito no D-187. */
  label: string;
  /** Categoria do catálogo do D-187. */
  category: 'PESO_LIVRE' | 'MAQUINAS' | 'FUNCIONAL_PESO_CORPORAL' | 'OUTRO';
  /** `false` quando o item da fonte não tem correspondente no catálogo. */
  exact: boolean;
}

const PESO_LIVRE = 'PESO_LIVRE' as const;
const MAQUINAS = 'MAQUINAS' as const;
const FUNCIONAL = 'FUNCIONAL_PESO_CORPORAL' as const;
const OUTRO_CAT = 'OUTRO' as const;

export const EQUIPMENT_MAPPING_BY_SOURCE_EQUIPMENT: Readonly<Record<string, EquipmentMapping>> = {
  barbell: {
    code: 'BARRAS_ANILHAS',
    label: 'Barras + anilhas',
    category: PESO_LIVRE,
    exact: true,
  },
  'e-z curl bar': {
    code: 'BARRA_OLIMPICA_W',
    label: 'Barra olímpica/W',
    category: PESO_LIVRE,
    exact: true,
  },
  dumbbell: {
    code: 'HALTERES_FIXOS',
    label: 'Halteres fixos',
    category: PESO_LIVRE,
    exact: true,
  },
  kettlebells: {
    code: 'KETTLEBELL',
    label: 'Kettlebell',
    category: PESO_LIVRE,
    exact: true,
  },
  cable: {
    code: 'CABOS_POLIA',
    label: 'Cabos/polia',
    category: MAQUINAS,
    exact: true,
  },
  machine: {
    code: 'MAQUINAS_GUIADAS',
    label: 'Máquinas guiadas',
    category: MAQUINAS,
    exact: true,
  },
  bands: {
    code: 'ELASTICOS_FAIXAS',
    label: 'Elásticos/faixas',
    category: FUNCIONAL,
    exact: true,
  },
  'exercise ball': {
    code: 'BOLA_SUICA',
    label: 'Bola suíça',
    category: FUNCIONAL,
    exact: true,
  },
  'body only': {
    code: 'NENHUM',
    label: 'Nenhum (peso corporal)',
    category: FUNCIONAL,
    exact: true,
  },
  // Sem correspondente no catálogo do D-187 — caem no "outro" livre que o
  // próprio D-187 prevê ("catálogo fixo + outro livre").
  'medicine ball': {
    code: 'OUTRO',
    label: 'Outro (medicine ball)',
    category: OUTRO_CAT,
    exact: false,
  },
  'foam roll': {
    code: 'OUTRO',
    label: 'Outro (rolo de liberação miofascial)',
    category: OUTRO_CAT,
    exact: false,
  },
  other: {
    code: 'OUTRO',
    label: 'Outro',
    category: OUTRO_CAT,
    exact: false,
  },
};

/** Destino de `equipment` nulo: sem equipamento = peso corporal. */
export const NO_EQUIPMENT_MAPPING: EquipmentMapping = {
  code: 'NENHUM',
  label: 'Nenhum (peso corporal)',
  category: FUNCIONAL,
  exact: true,
};

export function mapSourceEquipment(
  sourceEquipment: string | null | undefined,
): EquipmentMapping | null {
  if (sourceEquipment === null || sourceEquipment === undefined) {
    return NO_EQUIPMENT_MAPPING;
  }
  const key = sourceEquipment.trim().toLowerCase();
  if (key === '') return NO_EQUIPMENT_MAPPING;
  return EQUIPMENT_MAPPING_BY_SOURCE_EQUIPMENT[key] ?? null;
}

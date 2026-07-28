import type { SpecialtyCode } from '@fitvo/database';

/** Projecao do catalogo fixo de especialidades (D-047). */
export interface SpecialtyRecord {
  id: string;
  code: SpecialtyCode;
  name: string;
}

/**
 * Porta de persistencia do catalogo de especialidades (Repository Pattern). O
 * catalogo e FIXO e semeado na migracao (D-047) — este repositorio e so
 * leitura. `exists` e reusado pela slice `auth` como guard no cadastro do
 * profissional autonomo (D-137): a especialidade reivindicada no signup
 * precisa existir no catalogo antes de abrir a transacao de criacao da conta.
 */
export interface SpecialtyRepository {
  /** Lista o catalogo inteiro (publico — sem tenant/dado sensivel). */
  list(): Promise<SpecialtyRecord[]>;
  /** A especialidade existe no catalogo? */
  exists(specialtyId: string): Promise<boolean>;
  /**
   * Resolve o id a partir do `SpecialtyCode` (D-047). Usado pelo cadastro
   * publico de clinica quando o admin "tambem atende" (ADR-0015): o front envia
   * o code (enum), a persistencia precisa do id. `null` se o code nao existir no
   * catalogo (nunca deveria — o Zod ja valida o enum).
   */
  idByCode(code: SpecialtyCode): Promise<string | null>;
}

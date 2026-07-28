import type { SpecialtyCode } from '@fitvo/database';

import type { SpecialtyRepository } from './specialty-repository';

export interface SpecialtyView {
  id: string;
  code: SpecialtyCode;
  name: string;
}

export interface SpecialtyListResult {
  specialties: SpecialtyView[];
}

/**
 * Servico de aplicacao do catalogo de especialidades (D-047). So leitura —
 * catalogo publico e fixo, sem tenant/dado sensivel. Consumido pelo select do
 * cadastro publico de profissional (D-137): a UI precisa saber quais
 * especialidades existem (e seus ids reais) antes de submeter o cadastro.
 */
export class SpecialtyApplicationService {
  constructor(private readonly specialties: SpecialtyRepository) {}

  async list(): Promise<SpecialtyListResult> {
    const specialties = await this.specialties.list();
    return { specialties };
  }
}

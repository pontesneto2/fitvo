import type { BondCreatedEvent } from '@fitvo/queue';

import type { SharingRepository, SharingSuggestionRecord } from './sharing-repository';

/** Ordena o par de profissionais de forma estavel (A<B) — habilita o dedupe. */
function normalizePair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/**
 * Motor de deteccao de SOBREPOSICAO (D-017 — ADR-0003). Ao abrir um vinculo
 * (bond.created), verifica se o paciente passou a ter >=2 profissionais
 * DISTINTOS; em caso positivo, cria uma sugestao PENDING para cada par
 * recem-sobreposto (o novo profissional x cada um dos demais).
 *
 * IMPORTANTE: a sugestao NAO compartilha nada — o compartilhamento so acontece
 * sob consentimento explicito do paciente (nunca automatico). Dedupe: nao cria
 * PENDING duplicado para o mesmo par+especialidade. Datas/UTC ficam a cargo do
 * banco (default now()).
 */
export class OverlapDetectionService {
  constructor(private readonly repo: SharingRepository) {}

  async handleBondCreated(event: BondCreatedEvent): Promise<SharingSuggestionRecord[]> {
    const professionals = await this.repo.listActiveBondProfessionals(event.patientProfileId);
    const distinct = [...new Set(professionals)];

    // Sem sobreposicao: menos de 2 profissionais distintos -> nada a sugerir.
    if (distinct.length < 2) {
      return [];
    }

    const created: SharingSuggestionRecord[] = [];
    for (const other of distinct) {
      if (other === event.professionalProfileId) {
        continue;
      }
      const [professionalAId, professionalBId] = normalizePair(event.professionalProfileId, other);
      const alreadySuggested = await this.repo.hasPendingSuggestion(
        event.patientProfileId,
        professionalAId,
        professionalBId,
        event.specialtyId,
      );
      if (alreadySuggested) {
        continue;
      }
      const suggestion = await this.repo.createSuggestion({
        patientProfileId: event.patientProfileId,
        professionalAId,
        professionalBId,
        specialtyId: event.specialtyId,
      });
      // TODO(D-028): deliver via notifications adapter
      created.push(suggestion);
    }
    return created;
  }
}

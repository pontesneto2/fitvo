import type { SuggestionStatus } from '@fitvo/database';

/** Projecao de uma sugestao de compartilhamento (D-017). Par normalizado (A<B). */
export interface SharingSuggestionRecord {
  id: string;
  patientProfileId: string;
  professionalAId: string;
  professionalBId: string;
  specialtyId: string;
  status: SuggestionStatus;
}

export interface CreateSharingSuggestionInput {
  patientProfileId: string;
  professionalAId: string;
  professionalBId: string;
  specialtyId: string;
}

/**
 * Porta de persistencia do motor de compartilhamento (Repository Pattern). O
 * dominio (OverlapDetectionService) depende desta interface; a infra fornece a
 * implementacao Prisma (ou in-memory nos testes) — o motor e testavel SEM Redis.
 */
export interface SharingRepository {
  /** Ids DISTINTOS de profissionais com vinculo ATIVO deste paciente (D-017). */
  listActiveBondProfessionals(patientProfileId: string): Promise<string[]>;

  /**
   * Ja existe uma sugestao PENDING para este par (normalizado A<B) +
   * especialidade do paciente? Base do dedupe (nao duplicar sugestoes).
   */
  hasPendingSuggestion(
    patientProfileId: string,
    professionalAId: string,
    professionalBId: string,
    specialtyId: string,
  ): Promise<boolean>;

  /** Cria uma sugestao PENDING. Nada e compartilhado — e apenas um convite. */
  createSuggestion(input: CreateSharingSuggestionInput): Promise<SharingSuggestionRecord>;
}

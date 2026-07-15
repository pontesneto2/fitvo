import type {
  CreateSharingSuggestionInput,
  SharingRepository,
  SharingSuggestionRecord,
} from './sharing-repository';

/**
 * Implementacao em memoria do repositorio do motor (testes/dev). Espelha a
 * logica Prisma sobre estruturas simples — permite testar o motor sem Redis nem
 * Postgres. `seedActiveBond` arranja o mundo (os vinculos vem da slice de
 * paciente em producao).
 */
export class InMemorySharingRepository implements SharingRepository {
  private readonly suggestions: SharingSuggestionRecord[] = [];
  private readonly activeBonds = new Map<string, Set<string>>();
  private sequence = 0;

  /** Semeia um vinculo ATIVO (paciente -> profissional) para os testes. */
  seedActiveBond(patientProfileId: string, professionalProfileId: string): void {
    let set = this.activeBonds.get(patientProfileId);
    if (!set) {
      set = new Set<string>();
      this.activeBonds.set(patientProfileId, set);
    }
    set.add(professionalProfileId);
  }

  /** Sugestoes criadas (para asserts nos testes). */
  get created(): readonly SharingSuggestionRecord[] {
    return this.suggestions;
  }

  listActiveBondProfessionals(patientProfileId: string): Promise<string[]> {
    return Promise.resolve([...(this.activeBonds.get(patientProfileId) ?? new Set<string>())]);
  }

  hasPendingSuggestion(
    patientProfileId: string,
    professionalAId: string,
    professionalBId: string,
    specialtyId: string,
  ): Promise<boolean> {
    const exists = this.suggestions.some(
      (s) =>
        s.patientProfileId === patientProfileId &&
        s.professionalAId === professionalAId &&
        s.professionalBId === professionalBId &&
        s.specialtyId === specialtyId &&
        s.status === 'PENDING',
    );
    return Promise.resolve(exists);
  }

  createSuggestion(input: CreateSharingSuggestionInput): Promise<SharingSuggestionRecord> {
    this.sequence += 1;
    const suggestion: SharingSuggestionRecord = {
      id: `sug_${this.sequence}`,
      patientProfileId: input.patientProfileId,
      professionalAId: input.professionalAId,
      professionalBId: input.professionalBId,
      specialtyId: input.specialtyId,
      status: 'PENDING',
    };
    this.suggestions.push(suggestion);
    return Promise.resolve(suggestion);
  }
}

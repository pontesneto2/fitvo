import type { SpecialtyRecord, SpecialtyRepository } from './specialty-repository';

/**
 * Implementacao em memoria para testes e desenvolvimento local. `seedDefaultCatalog`
 * espelha o conteudo semeado pela migracao de producao (D-047) — mesmos 4 ids
 * fixos usados pelo `patient` module nos seus proprios testes (`seedSpecialty`).
 */
export class InMemorySpecialtyRepository implements SpecialtyRepository {
  private readonly bySpecialtyId = new Map<string, SpecialtyRecord>();

  /**
   * Semeia o catalogo padrao (mesmo conteudo das migracoes `init_identity` +
   * `seed_personal_trainer_specialty`).
   */
  seedDefaultCatalog(): void {
    this.seed({ id: 'spec_training', code: 'TRAINING', name: 'Treino' });
    this.seed({ id: 'spec_nutrition', code: 'NUTRITION', name: 'Nutricao' });
    this.seed({ id: 'spec_medicine', code: 'MEDICINE', name: 'Medicina' });
    this.seed({ id: 'spec_personal_trainer', code: 'PERSONAL_TRAINER', name: 'Personal Trainer' });
  }

  /** Semeia uma especialidade avulsa (testes que nao precisam do catalogo inteiro). */
  seed(specialty: SpecialtyRecord): void {
    this.bySpecialtyId.set(specialty.id, specialty);
  }

  list(): Promise<SpecialtyRecord[]> {
    return Promise.resolve([...this.bySpecialtyId.values()]);
  }

  exists(specialtyId: string): Promise<boolean> {
    return Promise.resolve(this.bySpecialtyId.has(specialtyId));
  }
}

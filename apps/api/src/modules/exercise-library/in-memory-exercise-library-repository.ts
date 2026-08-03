import { randomUUID } from 'node:crypto';

import { normalizeLibraryItemName } from '@fitvo/database';

import type {
  CreateExerciseInput,
  ExerciseLibraryRepository,
  ExerciseRecord,
  ListExercisesFilter,
  MuscleGroupRecord,
  UpdateExerciseInput,
} from './exercise-library-repository';

interface ProfessionalSeed {
  id: string;
  accountId: string;
  tenantId: string;
}

/** Catalogo padrao: espelha o seed da migracao de producao (D-164). */
const DEFAULT_MUSCLE_GROUPS: MuscleGroupRecord[] = [
  { id: 'mg_peito', code: 'PEITO', name: 'Peito', displayOrder: 10 },
  { id: 'mg_costas', code: 'COSTAS', name: 'Costas', displayOrder: 20 },
  { id: 'mg_ombro', code: 'OMBRO', name: 'Ombro', displayOrder: 30 },
  { id: 'mg_trapezio', code: 'TRAPEZIO', name: 'Trapezio', displayOrder: 40 },
  { id: 'mg_biceps', code: 'BICEPS', name: 'Biceps', displayOrder: 50 },
  { id: 'mg_triceps', code: 'TRICEPS', name: 'Triceps', displayOrder: 60 },
  { id: 'mg_antebraco', code: 'ANTEBRACO', name: 'Antebraco', displayOrder: 70 },
  { id: 'mg_abdomen', code: 'ABDOMEN', name: 'Abdomen', displayOrder: 80 },
  { id: 'mg_lombar', code: 'LOMBAR', name: 'Lombar', displayOrder: 90 },
  { id: 'mg_quadriceps', code: 'QUADRICEPS', name: 'Quadriceps', displayOrder: 100 },
  { id: 'mg_posterior_coxa', code: 'POSTERIOR_COXA', name: 'Posterior de coxa', displayOrder: 110 },
  { id: 'mg_gluteo', code: 'GLUTEO', name: 'Gluteo', displayOrder: 120 },
  { id: 'mg_adutores', code: 'ADUTORES', name: 'Adutores', displayOrder: 130 },
  { id: 'mg_abdutores', code: 'ABDUTORES', name: 'Abdutores', displayOrder: 140 },
  { id: 'mg_panturrilha', code: 'PANTURRILHA', name: 'Panturrilha', displayOrder: 150 },
  { id: 'mg_corpo_inteiro', code: 'CORPO_INTEIRO', name: 'Corpo inteiro', displayOrder: 160 },
];

/**
 * Implementacao em memoria da biblioteca de exercicios, para testes e dev
 * local. Reproduz as MESMAS regras de escopo do adaptador Prisma (D-171:
 * PLATFORM + os PRIVATE do proprio profissional) — se as duas divergirem, o
 * teste de fluxo passa e a producao vaza.
 */
export class InMemoryExerciseLibraryRepository implements ExerciseLibraryRepository {
  private readonly professionals = new Map<string, ProfessionalSeed>();
  private readonly muscleGroups = new Map<string, MuscleGroupRecord & { active: boolean }>();
  private readonly exercises = new Map<string, ExerciseRecord>();

  constructor() {
    this.seedDefaultMuscleGroups();
  }

  /** Semeia o catalogo padrao (mesmo conteudo da migracao de producao). */
  seedDefaultMuscleGroups(): void {
    for (const group of DEFAULT_MUSCLE_GROUPS) {
      this.muscleGroups.set(group.id, { ...group, active: true });
    }
  }

  /** Marca um grupo como DISCONTINUED (D-089) — some da busca e nao pode ser escolhido. */
  discontinueMuscleGroup(muscleGroupId: string): void {
    const group = this.muscleGroups.get(muscleGroupId);
    if (group) {
      this.muscleGroups.set(muscleGroupId, { ...group, active: false });
    }
  }

  /** Semeia um perfil profissional e devolve o `professionalProfileId` gerado. */
  seedProfessional(professional: Omit<ProfessionalSeed, 'id'>): string {
    const id = `prof_${randomUUID().slice(0, 8)}`;
    this.professionals.set(id, { ...professional, id });
    return id;
  }

  /**
   * Semeia um item da BASE COMUM (D-089): sem dono, `tenantId` NULL, visivel a
   * todo profissional de todo tenant.
   */
  seedPlatformExercise(name: string, primaryMuscleGroupId: string): ExerciseRecord {
    const now = new Date();
    const record: ExerciseRecord = {
      id: `ex_platform_${randomUUID().slice(0, 8)}`,
      name,
      description: null,
      videoStorageKey: null,
      visibility: 'PLATFORM',
      status: 'ACTIVE',
      specialtyId: null,
      ownerProfessionalProfileId: null,
      primaryMuscleGroup: this.requireGroup(primaryMuscleGroupId),
      secondaryMuscleGroups: [],
      createdAt: now,
      updatedAt: now,
    };
    this.exercises.set(record.id, record);
    this.normalizedByExerciseId.set(record.id, normalizeLibraryItemName(name));
    return record;
  }

  /** Nome normalizado por item (D-169) — no Prisma e uma coluna; aqui, um mapa paralelo. */
  private readonly normalizedByExerciseId = new Map<string, string>();

  findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null> {
    for (const professional of this.professionals.values()) {
      if (professional.accountId === accountId && professional.tenantId === tenantId) {
        return Promise.resolve({ professionalProfileId: professional.id });
      }
    }
    return Promise.resolve(null);
  }

  listMuscleGroups(): Promise<MuscleGroupRecord[]> {
    const active = [...this.muscleGroups.values()]
      .filter((group) => group.active)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
    return Promise.resolve(active.map(stripActive));
  }

  findMuscleGroupIds(ids: string[]): Promise<string[]> {
    return Promise.resolve(ids.filter((id) => this.muscleGroups.get(id)?.active === true));
  }

  listVisibleExercises(
    professionalProfileId: string,
    filter: ListExercisesFilter,
  ): Promise<ExerciseRecord[]> {
    const visible = [...this.exercises.values()]
      .filter((exercise) => this.isVisibleTo(exercise, professionalProfileId))
      .filter((exercise) => filter.includeDiscontinued === true || exercise.status === 'ACTIVE')
      .filter((exercise) => {
        if (filter.searchNormalized === undefined) {
          return true;
        }
        const normalized = this.normalizedByExerciseId.get(exercise.id) ?? '';
        return normalized.includes(filter.searchNormalized);
      })
      .filter((exercise) => {
        if (filter.muscleGroupId === undefined) {
          return true;
        }
        return (
          exercise.primaryMuscleGroup.id === filter.muscleGroupId ||
          exercise.secondaryMuscleGroups.some((group) => group.id === filter.muscleGroupId)
        );
      })
      .sort((a, b) =>
        (this.normalizedByExerciseId.get(a.id) ?? '').localeCompare(
          this.normalizedByExerciseId.get(b.id) ?? '',
        ),
      );
    return Promise.resolve(visible);
  }

  findVisibleExercise(
    professionalProfileId: string,
    exerciseId: string,
  ): Promise<ExerciseRecord | null> {
    const exercise = this.exercises.get(exerciseId);
    if (!exercise || !this.isVisibleTo(exercise, professionalProfileId)) {
      return Promise.resolve(null);
    }
    return Promise.resolve(exercise);
  }

  findEquivalentByNormalizedName(
    professionalProfileId: string,
    nameNormalized: string,
  ): Promise<ExerciseRecord | null> {
    const matches = [...this.exercises.values()]
      .filter((exercise) => this.isVisibleTo(exercise, professionalProfileId))
      .filter((exercise) => this.normalizedByExerciseId.get(exercise.id) === nameNormalized);
    // PLATFORM antes de PRIVATE — a base comum e oferecida primeiro (D-169).
    const platform = matches.find((exercise) => exercise.visibility === 'PLATFORM');
    return Promise.resolve(platform ?? matches[0] ?? null);
  }

  createExercise(input: CreateExerciseInput): Promise<ExerciseRecord> {
    const now = new Date();
    const record: ExerciseRecord = {
      id: `ex_${randomUUID().slice(0, 8)}`,
      name: input.name,
      description: input.description,
      videoStorageKey: input.videoStorageKey,
      // D-170 — default seguro: nasce PRIVATE, nunca PLATFORM.
      visibility: 'PRIVATE',
      status: 'ACTIVE',
      specialtyId: input.specialtyId,
      ownerProfessionalProfileId: input.ownerProfessionalProfileId,
      primaryMuscleGroup: this.requireGroup(input.primaryMuscleGroupId),
      secondaryMuscleGroups: input.secondaryMuscleGroupIds.map((id) => this.requireGroup(id)),
      createdAt: now,
      updatedAt: now,
    };
    this.exercises.set(record.id, record);
    this.normalizedByExerciseId.set(record.id, input.nameNormalized);
    return Promise.resolve(record);
  }

  updateExercise(exerciseId: string, input: UpdateExerciseInput): Promise<ExerciseRecord> {
    const current = this.requireExercise(exerciseId);
    const updated: ExerciseRecord = {
      ...current,
      name: input.name ?? current.name,
      description: input.description === undefined ? current.description : input.description,
      videoStorageKey:
        input.videoStorageKey === undefined ? current.videoStorageKey : input.videoStorageKey,
      primaryMuscleGroup:
        input.primaryMuscleGroupId === undefined
          ? current.primaryMuscleGroup
          : this.requireGroup(input.primaryMuscleGroupId),
      secondaryMuscleGroups:
        input.secondaryMuscleGroupIds === undefined
          ? current.secondaryMuscleGroups
          : input.secondaryMuscleGroupIds.map((id) => this.requireGroup(id)),
      updatedAt: new Date(),
    };
    this.exercises.set(exerciseId, updated);
    if (input.nameNormalized !== undefined) {
      this.normalizedByExerciseId.set(exerciseId, input.nameNormalized);
    }
    return Promise.resolve(updated);
  }

  discontinueExercise(exerciseId: string): Promise<ExerciseRecord> {
    const current = this.requireExercise(exerciseId);
    // D-089: troca de status, nunca remocao do mapa — o historico continua.
    const updated: ExerciseRecord = { ...current, status: 'DISCONTINUED', updatedAt: new Date() };
    this.exercises.set(exerciseId, updated);
    return Promise.resolve(updated);
  }

  /** D-171: PLATFORM e de todos; PRIVATE e so de quem criou. */
  private isVisibleTo(exercise: ExerciseRecord, professionalProfileId: string): boolean {
    return (
      exercise.visibility === 'PLATFORM' ||
      exercise.ownerProfessionalProfileId === professionalProfileId
    );
  }

  private requireGroup(muscleGroupId: string): MuscleGroupRecord {
    const group = this.muscleGroups.get(muscleGroupId);
    if (!group) {
      throw new Error(`InMemoryExerciseLibraryRepository: grupo ${muscleGroupId} nao semeado.`);
    }
    return stripActive(group);
  }

  private requireExercise(exerciseId: string): ExerciseRecord {
    const exercise = this.exercises.get(exerciseId);
    if (!exercise) {
      throw new Error(`InMemoryExerciseLibraryRepository: exercicio ${exerciseId} inexistente.`);
    }
    return exercise;
  }
}

function stripActive(group: MuscleGroupRecord & { active: boolean }): MuscleGroupRecord {
  return {
    id: group.id,
    code: group.code,
    name: group.name,
    displayOrder: group.displayOrder,
  };
}

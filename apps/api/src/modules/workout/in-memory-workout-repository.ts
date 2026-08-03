import type { PlanOrganization, SetTechnique, Weekday, WorkoutPlanStatus } from '@fitvo/database';

import type {
  CreateWorkoutInput,
  CreateWorkoutItemInput,
  CreateWorkoutPlanInput,
  UpdateWorkoutItemPatch,
  UpdateWorkoutPatch,
  UpdateWorkoutPlanPatch,
  WorkoutItemContext,
  WorkoutItemRecord,
  WorkoutPlanContext,
  WorkoutPlanDetailRecord,
  WorkoutPlanRecord,
  WorkoutRecord,
  WorkoutRepository,
  WorkoutSetInputRecord,
  WorkoutSetRecord,
} from './workout-repository';

interface StoredProfessional {
  id: string;
  accountId: string;
  tenantId: string;
}

interface StoredPatient {
  id: string;
  accountId: string;
}

interface StoredBond {
  id: string;
  tenantId: string;
  professionalProfileId: string;
  patientProfileId: string;
}

interface StoredPlan {
  id: string;
  tenantId: string;
  bondId: string;
  title: string;
  organization: PlanOrganization;
  status: WorkoutPlanStatus;
  validityDays: number;
  validUntil: Date | null;
  releaseAt: Date | null;
  goal: string | null;
  isFixed: boolean;
  fixedWeekdays: Weekday[];
  clonedFromWorkoutPlanId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface StoredWorkout {
  id: string;
  tenantId: string;
  bondId: string;
  planId: string;
  title: string;
  label: string | null;
  weekday: Weekday | null;
  position: number;
  deletedAt: Date | null;
}

interface StoredItem {
  id: string;
  tenantId: string;
  workoutId: string;
  exerciseId: string | null;
  position: number;
  supersetGroup: number | null;
  supersetOrder: number | null;
  note: string | null;
  deletedAt: Date | null;
}

interface StoredSet extends WorkoutSetInputRecord {
  id: string;
  tenantId: string;
  workoutItemId: string;
  position: number;
  deletedAt: Date | null;
}

/**
 * Double in-memory do repositório de prescrição de treino (ADR-0009). Reproduz
 * as REGRAS — os dois eixos de escopo (tenant + vínculo), o tombstone e a
 * substituição de séries em bloco — para que o teste de fluxo HTTP rode sem
 * Postgres.
 *
 * O que ele NÃO substitui: o teste de integração contra Postgres real. Escopo é
 * afirmação sobre uma cláusula SQL, e cláusula SQL só o banco executa — por isso
 * a clonagem profunda, a série-linha e o cross-tenant são provados lá também.
 */
export class InMemoryWorkoutRepository implements WorkoutRepository {
  private readonly professionals = new Map<string, StoredProfessional>();
  private readonly patients = new Map<string, StoredPatient>();
  private readonly bonds = new Map<string, StoredBond>();
  private readonly plans = new Map<string, StoredPlan>();
  private readonly workouts = new Map<string, StoredWorkout>();
  private readonly items = new Map<string, StoredItem>();
  private readonly sets = new Map<string, StoredSet>();
  private sequence = 0;

  // ---- Seeds de arranjo -----------------------------------------------------

  seedProfessional(input: { accountId: string; tenantId: string }): string {
    const id = this.nextId('pro');
    this.professionals.set(id, { id, ...input });
    return id;
  }

  seedPatient(input: { accountId: string }): string {
    const id = this.nextId('pat');
    this.patients.set(id, { id, ...input });
    return id;
  }

  seedBond(input: {
    tenantId: string;
    professionalProfileId: string;
    patientProfileId?: string;
  }): string {
    const id = this.nextId('bond');
    this.bonds.set(id, {
      id,
      tenantId: input.tenantId,
      professionalProfileId: input.professionalProfileId,
      patientProfileId: input.patientProfileId ?? this.nextId('pat'),
    });
    return id;
  }

  /** Marca um plano como já executado pelo aluno — cobre o gate do `replaceSets`. */
  private readonly executedItems = new Set<string>();

  seedExecutedItem(itemId: string): void {
    this.executedItems.add(itemId);
  }

  // ---- Porta ----------------------------------------------------------------

  async findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null> {
    const found = [...this.professionals.values()].find(
      (professional) => professional.accountId === accountId && professional.tenantId === tenantId,
    );
    return Promise.resolve(found ? { professionalProfileId: found.id } : null);
  }

  async findPatientProfile(accountId: string): Promise<{ patientProfileId: string } | null> {
    const found = [...this.patients.values()].find((patient) => patient.accountId === accountId);
    return Promise.resolve(found ? { patientProfileId: found.id } : null);
  }

  async findBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
  ): Promise<{ id: string } | null> {
    const bond = this.bonds.get(bondId);
    const visible =
      bond && bond.tenantId === tenantId && bond.professionalProfileId === professionalProfileId;
    return Promise.resolve(visible ? { id: bond.id } : null);
  }

  async createPlan(input: CreateWorkoutPlanInput): Promise<WorkoutPlanRecord> {
    const now = new Date();
    const plan: StoredPlan = {
      id: this.nextId('plan'),
      tenantId: input.tenantId,
      bondId: input.bondId,
      title: input.title,
      organization: input.organization,
      status: 'DRAFT',
      validityDays: input.validityDays,
      validUntil: input.validUntil,
      releaseAt: input.releaseAt,
      goal: input.goal,
      isFixed: input.isFixed,
      fixedWeekdays: input.fixedWeekdays,
      clonedFromWorkoutPlanId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.plans.set(plan.id, plan);
    return Promise.resolve(toPlanRecord(plan));
  }

  async listPlansByBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
    filter: { status?: WorkoutPlanStatus | undefined },
  ): Promise<WorkoutPlanRecord[] | null> {
    const bond = await this.findBond(tenantId, professionalProfileId, bondId);
    if (!bond) {
      return null;
    }
    return [...this.plans.values()]
      .filter(
        (plan) =>
          plan.tenantId === tenantId &&
          plan.bondId === bondId &&
          plan.deletedAt === null &&
          (filter.status === undefined || plan.status === filter.status),
      )
      .map(toPlanRecord);
  }

  async listPlansForPatient(patientProfileId: string): Promise<WorkoutPlanRecord[]> {
    const bondIds = new Set(
      [...this.bonds.values()]
        .filter((bond) => bond.patientProfileId === patientProfileId)
        .map((bond) => bond.id),
    );
    return Promise.resolve(
      [...this.plans.values()]
        .filter(
          (plan) => bondIds.has(plan.bondId) && plan.deletedAt === null && plan.status !== 'DRAFT',
        )
        .map(toPlanRecord),
    );
  }

  async findPlanContext(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
  ): Promise<WorkoutPlanContext | null> {
    const plan = this.visiblePlan(tenantId, professionalProfileId, planId);
    return Promise.resolve(
      plan
        ? {
            id: plan.id,
            bondId: plan.bondId,
            organization: plan.organization,
            status: plan.status,
            validityDays: plan.validityDays,
            releaseAt: plan.releaseAt,
          }
        : null,
    );
  }

  async findPlanDetail(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
  ): Promise<WorkoutPlanDetailRecord | null> {
    const plan = this.visiblePlan(tenantId, professionalProfileId, planId);
    if (!plan) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ ...toPlanRecord(plan), workouts: this.workoutsOfPlan(plan.id) });
  }

  async updatePlan(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
    patch: UpdateWorkoutPlanPatch,
  ): Promise<WorkoutPlanRecord | null> {
    const plan = this.visiblePlan(tenantId, professionalProfileId, planId);
    if (!plan) {
      return Promise.resolve(null);
    }
    assign(plan, patch, [
      'title',
      'organization',
      'validityDays',
      'validUntil',
      'releaseAt',
      'goal',
      'isFixed',
      'fixedWeekdays',
    ]);
    plan.updatedAt = new Date();
    return Promise.resolve(toPlanRecord(plan));
  }

  async updatePlanStatus(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
    status: WorkoutPlanStatus,
    validUntil?: Date | undefined,
  ): Promise<WorkoutPlanRecord | null> {
    const plan = this.visiblePlan(tenantId, professionalProfileId, planId);
    if (!plan) {
      return Promise.resolve(null);
    }
    plan.status = status;
    if (validUntil !== undefined) {
      plan.validUntil = validUntil;
    }
    plan.updatedAt = new Date();
    return Promise.resolve(toPlanRecord(plan));
  }

  async clonePlan(input: {
    tenantId: string;
    professionalProfileId: string;
    sourcePlanId: string;
    targetBondId: string;
    title: string | undefined;
    validUntil: Date;
  }): Promise<WorkoutPlanRecord | null> {
    const source = this.visiblePlan(
      input.tenantId,
      input.professionalProfileId,
      input.sourcePlanId,
    );
    if (!source) {
      return Promise.resolve(null);
    }

    const now = new Date();
    const plan: StoredPlan = {
      ...source,
      id: this.nextId('plan'),
      bondId: input.targetBondId,
      title: input.title ?? source.title,
      status: 'DRAFT',
      releaseAt: null,
      validUntil: input.validUntil,
      clonedFromWorkoutPlanId: source.id,
      createdAt: now,
      updatedAt: now,
    };
    this.plans.set(plan.id, plan);

    for (const workout of this.workoutsOfPlan(source.id)) {
      const copy: StoredWorkout = {
        id: this.nextId('wk'),
        tenantId: input.tenantId,
        bondId: input.targetBondId,
        planId: plan.id,
        title: workout.title,
        label: workout.label,
        weekday: workout.weekday,
        position: workout.position,
        deletedAt: null,
      };
      this.workouts.set(copy.id, copy);

      for (const item of workout.items) {
        const itemCopy: StoredItem = {
          id: this.nextId('item'),
          tenantId: input.tenantId,
          workoutId: copy.id,
          exerciseId: item.exerciseId,
          position: item.position,
          supersetGroup: item.supersetGroup,
          supersetOrder: item.supersetOrder,
          note: item.note,
          deletedAt: null,
        };
        this.items.set(itemCopy.id, itemCopy);

        for (const set of item.sets) {
          const setCopy: StoredSet = {
            ...set,
            id: this.nextId('set'),
            tenantId: input.tenantId,
            workoutItemId: itemCopy.id,
            deletedAt: null,
          };
          this.sets.set(setCopy.id, setCopy);
        }
      }
    }

    return Promise.resolve(toPlanRecord(plan));
  }

  async createWorkout(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
    input: CreateWorkoutInput,
  ): Promise<WorkoutRecord | null> {
    const plan = this.visiblePlan(tenantId, professionalProfileId, planId);
    if (!plan) {
      return Promise.resolve(null);
    }
    const workout: StoredWorkout = {
      id: this.nextId('wk'),
      tenantId,
      bondId: plan.bondId,
      planId,
      title: input.title,
      label: input.label,
      weekday: input.weekday,
      position: input.position,
      deletedAt: null,
    };
    this.workouts.set(workout.id, workout);
    return Promise.resolve(this.toWorkoutRecord(workout));
  }

  async findWorkoutPlanContext(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
  ): Promise<WorkoutPlanContext | null> {
    const workout = this.visibleWorkout(tenantId, professionalProfileId, workoutId);
    if (!workout) {
      return Promise.resolve(null);
    }
    return this.findPlanContext(tenantId, professionalProfileId, workout.planId);
  }

  async updateWorkout(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
    patch: UpdateWorkoutPatch,
  ): Promise<WorkoutRecord | null> {
    const workout = this.visibleWorkout(tenantId, professionalProfileId, workoutId);
    if (!workout) {
      return Promise.resolve(null);
    }
    assign(workout, patch, ['title', 'position']);
    if (patch.slot !== undefined) {
      workout.label = patch.slot.label;
      workout.weekday = patch.slot.weekday;
    }
    return Promise.resolve(this.toWorkoutRecord(workout));
  }

  async deleteWorkout(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
  ): Promise<boolean> {
    const workout = this.visibleWorkout(tenantId, professionalProfileId, workoutId);
    if (!workout) {
      return Promise.resolve(false);
    }
    const deletedAt = new Date();
    for (const item of this.liveItemsOf(workoutId)) {
      for (const set of this.liveSetsOf(item.id)) {
        set.deletedAt = deletedAt;
      }
      item.deletedAt = deletedAt;
    }
    workout.deletedAt = deletedAt;
    return Promise.resolve(true);
  }

  async createItem(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
    input: CreateWorkoutItemInput,
  ): Promise<WorkoutItemRecord | null> {
    const workout = this.visibleWorkout(tenantId, professionalProfileId, workoutId);
    if (!workout) {
      return Promise.resolve(null);
    }
    const item: StoredItem = {
      id: this.nextId('item'),
      tenantId,
      workoutId,
      exerciseId: input.exerciseId,
      position: input.position,
      supersetGroup: input.supersetGroup,
      supersetOrder: input.supersetOrder,
      note: input.note,
      deletedAt: null,
    };
    this.items.set(item.id, item);
    return Promise.resolve(this.toItemRecord(item));
  }

  async findItemContext(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
  ): Promise<WorkoutItemContext | null> {
    const item = this.visibleItem(tenantId, professionalProfileId, itemId);
    if (!item) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      id: item.id,
      workoutId: item.workoutId,
      supersetGroup: item.supersetGroup,
      peers: this.liveItemsOf(item.workoutId).map((peer) => ({
        id: peer.id,
        supersetGroup: peer.supersetGroup,
        setCount: this.liveSetsOf(peer.id).length,
      })),
    });
  }

  async updateItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
    patch: UpdateWorkoutItemPatch,
  ): Promise<WorkoutItemRecord | null> {
    const item = this.visibleItem(tenantId, professionalProfileId, itemId);
    if (!item) {
      return Promise.resolve(null);
    }
    assign(item, patch, ['exerciseId', 'position', 'supersetGroup', 'supersetOrder', 'note']);
    return Promise.resolve(this.toItemRecord(item));
  }

  async deleteItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
  ): Promise<boolean> {
    const item = this.visibleItem(tenantId, professionalProfileId, itemId);
    if (!item) {
      return Promise.resolve(false);
    }
    const deletedAt = new Date();
    for (const set of this.liveSetsOf(itemId)) {
      set.deletedAt = deletedAt;
    }
    item.deletedAt = deletedAt;
    return Promise.resolve(true);
  }

  async replaceSets(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
    sets: WorkoutSetInputRecord[],
  ): Promise<WorkoutItemRecord | null> {
    const item = this.visibleItem(tenantId, professionalProfileId, itemId);
    if (!item) {
      return Promise.resolve(null);
    }
    if (this.executedItems.has(itemId)) {
      return Promise.reject(
        new Error('Item ja executado — o double reproduz o gate do repositorio Prisma.'),
      );
    }
    for (const set of this.liveSetsOf(itemId)) {
      this.sets.delete(set.id);
    }
    sets.forEach((set, position) => {
      const stored: StoredSet = {
        ...set,
        id: this.nextId('set'),
        tenantId,
        workoutItemId: itemId,
        position,
        deletedAt: null,
      };
      this.sets.set(stored.id, stored);
    });
    return Promise.resolve(this.toItemRecord(item));
  }

  // ---- Internos -------------------------------------------------------------

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }

  private visiblePlan(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
  ): StoredPlan | null {
    const plan = this.plans.get(planId);
    if (!plan || plan.deletedAt !== null || plan.tenantId !== tenantId) {
      return null;
    }
    const bond = this.bonds.get(plan.bondId);
    return bond?.professionalProfileId === professionalProfileId ? plan : null;
  }

  private visibleWorkout(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
  ): StoredWorkout | null {
    const workout = this.workouts.get(workoutId);
    if (!workout || workout.deletedAt !== null || workout.tenantId !== tenantId) {
      return null;
    }
    return this.visiblePlan(tenantId, professionalProfileId, workout.planId) ? workout : null;
  }

  private visibleItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
  ): StoredItem | null {
    const item = this.items.get(itemId);
    if (!item || item.deletedAt !== null || item.tenantId !== tenantId) {
      return null;
    }
    return this.visibleWorkout(tenantId, professionalProfileId, item.workoutId) ? item : null;
  }

  private liveItemsOf(workoutId: string): StoredItem[] {
    return [...this.items.values()]
      .filter((item) => item.workoutId === workoutId && item.deletedAt === null)
      .sort((a, b) => a.position - b.position);
  }

  private liveSetsOf(itemId: string): StoredSet[] {
    return [...this.sets.values()]
      .filter((set) => set.workoutItemId === itemId && set.deletedAt === null)
      .sort((a, b) => a.position - b.position);
  }

  private workoutsOfPlan(planId: string): WorkoutRecord[] {
    return [...this.workouts.values()]
      .filter((workout) => workout.planId === planId && workout.deletedAt === null)
      .sort((a, b) => a.position - b.position)
      .map((workout) => this.toWorkoutRecord(workout));
  }

  private toWorkoutRecord(workout: StoredWorkout): WorkoutRecord {
    return {
      id: workout.id,
      planId: workout.planId,
      title: workout.title,
      label: workout.label,
      weekday: workout.weekday,
      position: workout.position,
      items: this.liveItemsOf(workout.id).map((item) => this.toItemRecord(item)),
    };
  }

  private toItemRecord(item: StoredItem): WorkoutItemRecord {
    return {
      id: item.id,
      workoutId: item.workoutId,
      exerciseId: item.exerciseId,
      position: item.position,
      supersetGroup: item.supersetGroup,
      supersetOrder: item.supersetOrder,
      note: item.note,
      sets: this.liveSetsOf(item.id).map(toSetRecord),
    };
  }
}

function toPlanRecord(plan: StoredPlan): WorkoutPlanRecord {
  return {
    id: plan.id,
    bondId: plan.bondId,
    title: plan.title,
    organization: plan.organization,
    status: plan.status,
    validityDays: plan.validityDays,
    validUntil: plan.validUntil,
    releaseAt: plan.releaseAt,
    goal: plan.goal,
    isFixed: plan.isFixed,
    fixedWeekdays: plan.fixedWeekdays,
    clonedFromWorkoutPlanId: plan.clonedFromWorkoutPlanId,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

function toSetRecord(set: StoredSet): WorkoutSetRecord {
  return {
    id: set.id,
    workoutItemId: set.workoutItemId,
    position: set.position,
    reps: set.reps,
    repsToFailure: set.repsToFailure,
    weightGrams: set.weightGrams,
    durationSeconds: set.durationSeconds,
    distanceMeters: set.distanceMeters,
    bodyweight: set.bodyweight,
    restSeconds: set.restSeconds,
    technique: set.technique satisfies SetTechnique,
    note: set.note,
  };
}

/** Copia só as chaves presentes no patch — `undefined` significa "não mexer". */
function assign<T, P extends object>(target: T, patch: P, keys: (keyof P & keyof T)[]): void {
  for (const key of keys) {
    const value = patch[key];
    if (value !== undefined) {
      target[key] = value as unknown as T[typeof key];
    }
  }
}

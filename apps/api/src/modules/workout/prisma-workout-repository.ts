import type { PrismaClient, WorkoutPlanStatus } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import { WorkoutPlanStateConflictError } from '../../shared/http-errors';
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
} from './workout-repository';

const PLAN_PROJECTION = {
  id: true,
  bondId: true,
  title: true,
  organization: true,
  status: true,
  validityDays: true,
  validUntil: true,
  releaseAt: true,
  goal: true,
  isFixed: true,
  fixedWeekdays: true,
  clonedFromWorkoutPlanId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SET_PROJECTION = {
  id: true,
  workoutItemId: true,
  position: true,
  reps: true,
  repsToFailure: true,
  weightGrams: true,
  durationSeconds: true,
  distanceMeters: true,
  bodyweight: true,
  restSeconds: true,
  technique: true,
  note: true,
} as const;

/** Tombstone (D-089/D-099): o que foi apagado logicamente nunca volta na leitura. */
const LIVE = { deletedAt: null } as const;

const ITEM_PROJECTION = {
  id: true,
  workoutId: true,
  exerciseId: true,
  position: true,
  supersetGroup: true,
  supersetOrder: true,
  note: true,
  sets: { where: LIVE, select: SET_PROJECTION, orderBy: { position: 'asc' } },
} as const;

const WORKOUT_PROJECTION = {
  id: true,
  planId: true,
  title: true,
  label: true,
  weekday: true,
  position: true,
  items: { where: LIVE, select: ITEM_PROJECTION, orderBy: { position: 'asc' } },
} as const;

const PLAN_CONTEXT_PROJECTION = {
  id: true,
  bondId: true,
  organization: true,
  status: true,
  validityDays: true,
  releaseAt: true,
} as const;

/**
 * Implementação Prisma (infra) do repositório da prescrição de treino —
 * Bloco 2 (ADR-0009).
 *
 * TODO PREDICADO CARREGA AS DUAS CAMADAS DE ESCOPO, sem exceção (D-166/D-079):
 * `tenantId` na própria linha (a coluna que o retrofit do #131 criou justamente
 * para isso) E `bond: { professionalProfileId }` — ou o caminho equivalente
 * pelo pai, quando a tabela não tem `bondId` próprio. Não existe aqui uma
 * consulta por id puro: mesmo `findUnique` de releitura só roda DEPOIS de um
 * `updateMany` escopado ter confirmado que a linha é do chamador.
 *
 * DELEÇÃO É SEMPRE LÓGICA (D-089): `deletedAt`, nunca `DELETE`. Tombstone
 * também é o que o pull do sync lê (D-099).
 */
export class PrismaWorkoutRepository implements WorkoutRepository {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null> {
    const profile = await this.db.professionalProfile.findFirst({
      where: { accountId, tenantId },
      select: { id: true },
    });
    return profile ? { professionalProfileId: profile.id } : null;
  }

  async findPatientProfile(accountId: string): Promise<{ patientProfileId: string } | null> {
    const profile = await this.db.patientProfile.findFirst({
      where: { accountId },
      select: { id: true },
    });
    return profile ? { patientProfileId: profile.id } : null;
  }

  findBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
  ): Promise<{ id: string } | null> {
    return this.db.bond.findFirst({
      where: { id: bondId, tenantId, professionalProfileId },
      select: { id: true },
    });
  }

  createPlan(input: CreateWorkoutPlanInput): Promise<WorkoutPlanRecord> {
    return this.db.workoutPlan.create({
      data: {
        tenantId: input.tenantId,
        bondId: input.bondId,
        title: input.title,
        organization: input.organization,
        validityDays: input.validityDays,
        validUntil: input.validUntil,
        releaseAt: input.releaseAt,
        goal: input.goal,
        isFixed: input.isFixed,
        fixedWeekdays: input.fixedWeekdays,
      },
      select: PLAN_PROJECTION,
    });
  }

  async listPlansByBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
    filter: { status?: WorkoutPlanStatus | undefined },
  ): Promise<WorkoutPlanRecord[] | null> {
    // O vínculo é conferido ANTES de listar: sem isso, um bond de outro
    // profissional devolveria lista vazia (200) em vez de 404 — e "vazio" é uma
    // resposta que ensina ao chamador que o id existe.
    const bond = await this.findBond(tenantId, professionalProfileId, bondId);
    if (!bond) {
      return null;
    }
    return this.db.workoutPlan.findMany({
      where: { tenantId, bondId, ...LIVE, ...(filter.status ? { status: filter.status } : {}) },
      select: PLAN_PROJECTION,
      orderBy: { createdAt: 'desc' },
    });
  }

  listPlansForPatient(patientProfileId: string): Promise<WorkoutPlanRecord[]> {
    return this.db.workoutPlan.findMany({
      where: {
        bond: { patientProfileId },
        ...LIVE,
        // D-165 na CLÁUSULA, não no chamador: o aluno nunca vê rascunho, e uma
        // regra de visibilidade que depende de alguém lembrar de aplicá-la não
        // é uma regra de visibilidade.
        status: { not: 'DRAFT' },
      },
      select: PLAN_PROJECTION,
      orderBy: { createdAt: 'desc' },
    });
  }

  findPlanContext(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
  ): Promise<WorkoutPlanContext | null> {
    return this.db.workoutPlan.findFirst({
      where: { id: planId, tenantId, bond: { professionalProfileId }, ...LIVE },
      select: PLAN_CONTEXT_PROJECTION,
    });
  }

  findPlanDetail(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
  ): Promise<WorkoutPlanDetailRecord | null> {
    return this.db.workoutPlan.findFirst({
      where: { id: planId, tenantId, bond: { professionalProfileId }, ...LIVE },
      select: {
        ...PLAN_PROJECTION,
        workouts: { where: LIVE, select: WORKOUT_PROJECTION, orderBy: { position: 'asc' } },
      },
    });
  }

  async updatePlan(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
    patch: UpdateWorkoutPlanPatch,
  ): Promise<WorkoutPlanRecord | null> {
    const result = await this.db.workoutPlan.updateMany({
      where: { id: planId, tenantId, bond: { professionalProfileId }, ...LIVE },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.organization !== undefined ? { organization: patch.organization } : {}),
        ...(patch.validityDays !== undefined ? { validityDays: patch.validityDays } : {}),
        ...(patch.validUntil !== undefined ? { validUntil: patch.validUntil } : {}),
        ...(patch.releaseAt !== undefined ? { releaseAt: patch.releaseAt } : {}),
        ...(patch.goal !== undefined ? { goal: patch.goal } : {}),
        ...(patch.isFixed !== undefined ? { isFixed: patch.isFixed } : {}),
        ...(patch.fixedWeekdays !== undefined ? { fixedWeekdays: patch.fixedWeekdays } : {}),
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.db.workoutPlan.findUnique({ where: { id: planId }, select: PLAN_PROJECTION });
  }

  async updatePlanStatus(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
    status: WorkoutPlanStatus,
    validUntil?: Date | undefined,
  ): Promise<WorkoutPlanRecord | null> {
    const result = await this.db.workoutPlan.updateMany({
      where: { id: planId, tenantId, bond: { professionalProfileId }, ...LIVE },
      data: { status, ...(validUntil === undefined ? {} : { validUntil }) },
    });
    if (result.count === 0) {
      return null;
    }
    return this.db.workoutPlan.findUnique({ where: { id: planId }, select: PLAN_PROJECTION });
  }

  /**
   * D-090 — cópia PROFUNDA numa transação. Ou o vínculo de destino recebe o
   * plano inteiro (treinos, itens e séries), ou não recebe nada: um plano meio
   * copiado seria prescrição incompleta chegando a um paciente real.
   *
   * O que NÃO é copiado, deliberadamente: `status` (a cópia nasce DRAFT — o
   * D-165 não deixa um plano chegar liberado ao aluno de destino por acidente),
   * `releaseAt` (agendamento é da origem) e toda a execução — `WorkoutSession`/
   * `SetLog` do aluno de origem não têm nada a ver com o de destino.
   */
  async clonePlan(input: {
    tenantId: string;
    professionalProfileId: string;
    sourcePlanId: string;
    targetBondId: string;
    title: string | undefined;
    validUntil: Date;
  }): Promise<WorkoutPlanRecord | null> {
    const source = await this.findPlanDetail(
      input.tenantId,
      input.professionalProfileId,
      input.sourcePlanId,
    );
    if (!source) {
      return null;
    }

    return this.db.$transaction(async (tx) => {
      const plan = await tx.workoutPlan.create({
        data: {
          tenantId: input.tenantId,
          bondId: input.targetBondId,
          title: input.title ?? source.title,
          organization: source.organization,
          validityDays: source.validityDays,
          validUntil: input.validUntil,
          goal: source.goal,
          isFixed: source.isFixed,
          fixedWeekdays: source.fixedWeekdays,
          // Linhagem SEM relation (D-090): o plano de origem é de OUTRO vínculo,
          // e uma FK criaria um caminho de join que vazaria dado de outro
          // paciente. É ponteiro de auditoria, não rota de leitura.
          clonedFromWorkoutPlanId: source.id,
        },
        select: PLAN_PROJECTION,
      });

      for (const workout of source.workouts) {
        const copy = await tx.workout.create({
          data: {
            tenantId: input.tenantId,
            bondId: input.targetBondId,
            planId: plan.id,
            title: workout.title,
            label: workout.label,
            weekday: workout.weekday,
            position: workout.position,
          },
          select: { id: true },
        });

        for (const item of workout.items) {
          const itemCopy = await tx.workoutItem.create({
            data: {
              tenantId: input.tenantId,
              workoutId: copy.id,
              exerciseId: item.exerciseId,
              position: item.position,
              supersetGroup: item.supersetGroup,
              supersetOrder: item.supersetOrder,
              note: item.note,
            },
            select: { id: true },
          });

          if (item.sets.length > 0) {
            await tx.workoutSet.createMany({
              data: item.sets.map((set) => ({
                tenantId: input.tenantId,
                workoutItemId: itemCopy.id,
                position: set.position,
                reps: set.reps,
                repsToFailure: set.repsToFailure,
                weightGrams: set.weightGrams,
                durationSeconds: set.durationSeconds,
                distanceMeters: set.distanceMeters,
                bodyweight: set.bodyweight,
                restSeconds: set.restSeconds,
                technique: set.technique,
                note: set.note,
              })),
            });
          }
        }
      }

      return plan;
    });
  }

  async createWorkout(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
    input: CreateWorkoutInput,
  ): Promise<WorkoutRecord | null> {
    const plan = await this.db.workoutPlan.findFirst({
      where: { id: planId, tenantId, bond: { professionalProfileId }, ...LIVE },
      select: { id: true, bondId: true },
    });
    if (!plan) {
      return null;
    }
    return this.db.workout.create({
      data: {
        tenantId,
        bondId: plan.bondId,
        planId,
        title: input.title,
        label: input.label,
        weekday: input.weekday,
        position: input.position,
      },
      select: WORKOUT_PROJECTION,
    });
  }

  async findWorkoutPlanContext(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
  ): Promise<WorkoutPlanContext | null> {
    const workout = await this.db.workout.findFirst({
      where: {
        id: workoutId,
        tenantId,
        bond: { professionalProfileId },
        ...LIVE,
        plan: LIVE,
      },
      select: { plan: { select: PLAN_CONTEXT_PROJECTION } },
    });
    return workout?.plan ?? null;
  }

  async updateWorkout(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
    patch: UpdateWorkoutPatch,
  ): Promise<WorkoutRecord | null> {
    const result = await this.db.workout.updateMany({
      where: { id: workoutId, tenantId, bond: { professionalProfileId }, ...LIVE },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.position !== undefined ? { position: patch.position } : {}),
        ...(patch.slot === undefined
          ? {}
          : { label: patch.slot.label, weekday: patch.slot.weekday }),
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.db.workout.findUnique({ where: { id: workoutId }, select: WORKOUT_PROJECTION });
  }

  /**
   * Tombstone em CASCATA lógica (D-089): o treino sai, e com ele os itens e as
   * séries. Sem descer a árvore, um item ficaria "vivo" sem pai visível — e
   * qualquer leitura que entre pelo item (o contexto de conjugado, o sync)
   * voltaria a enxergá-lo.
   */
  async deleteWorkout(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
  ): Promise<boolean> {
    const workout = await this.db.workout.findFirst({
      where: { id: workoutId, tenantId, bond: { professionalProfileId }, ...LIVE },
      select: { id: true },
    });
    if (!workout) {
      return false;
    }
    const deletedAt = new Date();
    await this.db.$transaction([
      this.db.workoutSet.updateMany({
        where: { tenantId, workoutItem: { workoutId }, ...LIVE },
        data: { deletedAt },
      }),
      this.db.workoutItem.updateMany({
        where: { tenantId, workoutId, ...LIVE },
        data: { deletedAt },
      }),
      this.db.workout.updateMany({
        where: { id: workoutId, tenantId, ...LIVE },
        data: { deletedAt },
      }),
    ]);
    return true;
  }

  async createItem(
    tenantId: string,
    professionalProfileId: string,
    workoutId: string,
    input: CreateWorkoutItemInput,
  ): Promise<WorkoutItemRecord | null> {
    const workout = await this.db.workout.findFirst({
      where: { id: workoutId, tenantId, bond: { professionalProfileId }, ...LIVE, plan: LIVE },
      select: { id: true },
    });
    if (!workout) {
      return null;
    }
    return this.db.workoutItem.create({
      data: {
        tenantId,
        workoutId,
        exerciseId: input.exerciseId,
        position: input.position,
        supersetGroup: input.supersetGroup,
        supersetOrder: input.supersetOrder,
        note: input.note,
      },
      select: ITEM_PROJECTION,
    });
  }

  async findItemContext(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
  ): Promise<WorkoutItemContext | null> {
    const item = await this.db.workoutItem.findFirst({
      where: {
        id: itemId,
        tenantId,
        ...LIVE,
        workout: { tenantId, bond: { professionalProfileId }, ...LIVE, plan: LIVE },
      },
      select: {
        id: true,
        workoutId: true,
        supersetGroup: true,
        workout: {
          select: {
            items: {
              where: LIVE,
              select: {
                id: true,
                supersetGroup: true,
                _count: { select: { sets: { where: LIVE } } },
              },
            },
          },
        },
      },
    });
    if (!item) {
      return null;
    }
    return {
      id: item.id,
      workoutId: item.workoutId,
      supersetGroup: item.supersetGroup,
      peers: item.workout.items.map((peer) => ({
        id: peer.id,
        supersetGroup: peer.supersetGroup,
        setCount: peer._count.sets,
      })),
    };
  }

  async updateItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
    patch: UpdateWorkoutItemPatch,
  ): Promise<WorkoutItemRecord | null> {
    const result = await this.db.workoutItem.updateMany({
      where: {
        id: itemId,
        tenantId,
        ...LIVE,
        workout: { tenantId, bond: { professionalProfileId }, ...LIVE },
      },
      data: {
        ...(patch.exerciseId !== undefined ? { exerciseId: patch.exerciseId } : {}),
        ...(patch.position !== undefined ? { position: patch.position } : {}),
        ...(patch.supersetGroup !== undefined ? { supersetGroup: patch.supersetGroup } : {}),
        ...(patch.supersetOrder !== undefined ? { supersetOrder: patch.supersetOrder } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.db.workoutItem.findUnique({ where: { id: itemId }, select: ITEM_PROJECTION });
  }

  async deleteItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
  ): Promise<boolean> {
    const item = await this.db.workoutItem.findFirst({
      where: {
        id: itemId,
        tenantId,
        ...LIVE,
        workout: { tenantId, bond: { professionalProfileId }, ...LIVE },
      },
      select: { id: true },
    });
    if (!item) {
      return false;
    }
    const deletedAt = new Date();
    await this.db.$transaction([
      this.db.workoutSet.updateMany({
        where: { tenantId, workoutItemId: itemId, ...LIVE },
        data: { deletedAt },
      }),
      this.db.workoutItem.updateMany({
        where: { id: itemId, tenantId, ...LIVE },
        data: { deletedAt },
      }),
    ]);
    return true;
  }

  /**
   * D-081 — substitui a lista inteira de séries do item, em TRANSAÇÃO.
   *
   * As séries antigas são DESTRUÍDAS (não tombstoneadas) por uma razão de
   * schema: `@@unique([workoutItemId, position])` não é parcial, então uma
   * linha morta na posição 0 impediria a nova série 0 de existir. Isso é
   * seguro porque `SetLog.workoutSet` é `onDelete: Restrict` — o banco se
   * recusa a apagar uma série que o aluno já executou.
   *
   * Essa recusa vira um 409 explícito, checado ANTES do delete: editar a
   * prescrição de um item JÁ EXECUTADO é conflito real entre o D-085 (o
   * profissional edita a ficha quando quer) e o D-100 (histórico não se apaga),
   * e nenhum ADR resolveu qual vence. Não inventamos a resolução aqui — o caso
   * não é alcançável antes do Bloco 3 (execução), que ainda não existe.
   */
  async replaceSets(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
    sets: WorkoutSetInputRecord[],
  ): Promise<WorkoutItemRecord | null> {
    const item = await this.db.workoutItem.findFirst({
      where: {
        id: itemId,
        tenantId,
        ...LIVE,
        workout: { tenantId, bond: { professionalProfileId }, ...LIVE, plan: LIVE },
      },
      select: { id: true },
    });
    if (!item) {
      return null;
    }

    const executed = await this.db.setLog.count({
      where: { workoutSet: { workoutItemId: itemId } },
    });
    if (executed > 0) {
      throw new WorkoutPlanStateConflictError(
        'Este exercicio ja tem execucao registrada pelo aluno; a troca das series ' +
          'apagaria historico (D-100). Prescreva um item novo.',
      );
    }

    await this.db.$transaction(async (tx) => {
      await tx.workoutSet.deleteMany({ where: { workoutItemId: itemId, tenantId } });
      if (sets.length > 0) {
        await tx.workoutSet.createMany({
          // A posição É o índice na lista (D-081): não há como o cliente
          // informar duas séries na mesma ordem.
          data: sets.map((set, position) => ({
            tenantId,
            workoutItemId: itemId,
            position,
            reps: set.reps,
            repsToFailure: set.repsToFailure,
            weightGrams: set.weightGrams,
            durationSeconds: set.durationSeconds,
            distanceMeters: set.distanceMeters,
            bodyweight: set.bodyweight,
            restSeconds: set.restSeconds,
            technique: set.technique,
            note: set.note,
          })),
        });
      }
    });

    return this.db.workoutItem.findUnique({ where: { id: itemId }, select: ITEM_PROJECTION });
  }
}

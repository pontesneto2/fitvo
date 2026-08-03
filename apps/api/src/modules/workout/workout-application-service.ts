import type { Weekday, WorkoutPlanStatus } from '@fitvo/database';
import type {
  WorkoutClonePlanInput,
  WorkoutCreateItemInput,
  WorkoutCreatePlanInput,
  WorkoutCreateWorkoutInput,
  WorkoutItemView,
  WorkoutPlanDetailView,
  WorkoutPlanListQuery,
  WorkoutPlanSummaryView,
  WorkoutReplaceSetsInput,
  WorkoutSetView,
  WorkoutUpdateItemInput,
  WorkoutUpdatePlanInput,
  WorkoutUpdateWorkoutInput,
  WorkoutView,
} from '@fitvo/validation';

import type { AccessTokenVerifier } from '../../shared/auth-context';
import { requireAuth } from '../../shared/auth-context';
import {
  ForbiddenError,
  NotFoundError,
  WorkoutPlanStateConflictError,
} from '../../shared/http-errors';
import {
  assertSupersetGroupsComplete,
  assertSupersetSetCounts,
  deriveValidUntil,
  planCountsTowardAdherence,
  resolveWorkoutSlot,
  type SupersetPeer,
} from './workout-domain';
import type {
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

/** D-083: 30 dias é o padrão quando o profissional não configura outro. */
const DEFAULT_VALIDITY_DAYS = 30;

/**
 * Estados em que a PRESCRIÇÃO ainda pode ser mexida. `EXPIRED` entra de
 * propósito: plano vencido é justamente o que o profissional abre para renovar
 * (D-083 — o aluno nunca fica sem nada). `ARCHIVED` fica de fora: arquivar é
 * encerrar preservando o histórico (D-053), e histórico que muda não é
 * histórico.
 */
const EDITABLE_PLAN_STATUSES: readonly WorkoutPlanStatus[] = [
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'EXPIRED',
];

function toSetView(set: WorkoutSetRecord): WorkoutSetView {
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
    technique: set.technique,
    note: set.note,
  };
}

function toItemView(item: WorkoutItemRecord): WorkoutItemView {
  return {
    id: item.id,
    workoutId: item.workoutId,
    exerciseId: item.exerciseId,
    position: item.position,
    supersetGroup: item.supersetGroup,
    supersetOrder: item.supersetOrder,
    note: item.note,
    sets: item.sets.map(toSetView),
  };
}

function toWorkoutView(workout: WorkoutRecord): WorkoutView {
  return {
    id: workout.id,
    planId: workout.planId,
    title: workout.title,
    label: workout.label,
    weekday: workout.weekday,
    position: workout.position,
    items: workout.items.map(toItemView),
  };
}

function toPlanView(plan: WorkoutPlanRecord): WorkoutPlanSummaryView {
  return {
    id: plan.id,
    bondId: plan.bondId,
    title: plan.title,
    organization: plan.organization,
    status: plan.status,
    validityDays: plan.validityDays,
    validUntil: plan.validUntil?.toISOString() ?? null,
    releaseAt: plan.releaseAt?.toISOString() ?? null,
    goal: plan.goal,
    isFixed: plan.isFixed,
    fixedWeekdays: plan.fixedWeekdays,
    // D-105 derivado no servidor, uma vez — nenhum consumidor reimplementa.
    countsTowardAdherence: planCountsTowardAdherence(plan),
    clonedFromWorkoutPlanId: plan.clonedFromWorkoutPlanId,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function toPlanDetailView(plan: WorkoutPlanDetailRecord): WorkoutPlanDetailView {
  return { ...toPlanView(plan), workouts: plan.workouts.map(toWorkoutView) };
}

function parseDate(value: string | null | undefined): Date | null {
  return value === null || value === undefined ? null : new Date(value);
}

/**
 * Serviço de aplicação da PRESCRIÇÃO de treino — Bloco 2 (ADR-0009):
 * `WorkoutPlan -> Workout -> WorkoutItem -> WorkoutSet` + clonagem (D-090).
 *
 * O que este serviço garante e o banco não:
 *
 * 1. ESCOPO EM DUAS CAMADAS (D-166 + D-079) — todo caminho exige perfil
 *    profissional NESTE tenant e que o vínculo/recurso seja dele. O `tenantId`
 *    do path é controlado pelo cliente: ele serve ao contexto e ao filtro da
 *    extension, nunca de prova de pertencimento — quem prova é o guard.
 *
 * 2. SÉRIE-LINHA (D-081) — séries chegam como LISTA e são substituídas em
 *    bloco; a posição é o índice. Não existe caminho que produza "3×12"
 *    uniforme, porque não existe campo de repetição de série.
 *
 * 3. INVARIANTES DE DOMÍNIO — coerência plano↔treino (D-080) e contagem de
 *    séries no conjugado (D-082) são verificadas aqui, em `workout-domain.ts`.
 *
 * 4. VALIDADE (D-083) — `validUntil` é sempre DERIVADO (`releaseAt ?? agora` +
 *    `validityDays`), nunca aceito do cliente: data de vencimento enviada de
 *    fora divergiria da regra na primeira edição.
 *
 * Fora de escopo (blocos próprios): execução do aluno (D-086), avaliação
 * (D-087), análise de forma por IA (D-088), progressão sugerida (D-167) e as
 * réguas de worker de vencimento/liberação (D-083/D-084).
 */
export class WorkoutApplicationService {
  constructor(
    private readonly workouts: WorkoutRepository,
    private readonly tokenVerifier: AccessTokenVerifier,
  ) {}

  // ---- Plano ----------------------------------------------------------------

  async createPlan(
    authorization: string | undefined,
    tenantId: string,
    bondId: string,
    input: WorkoutCreatePlanInput,
  ): Promise<WorkoutPlanSummaryView> {
    await this.requireBond(authorization, tenantId, bondId);

    const validityDays = input.validityDays ?? DEFAULT_VALIDITY_DAYS;
    const releaseAt = parseDate(input.releaseAt);
    const plan = await this.workouts.createPlan({
      tenantId,
      bondId,
      title: input.title,
      organization: input.organization,
      validityDays,
      // D-083: o plano JÁ NASCE com vencimento calculado. Deixar nulo até a
      // liberação criaria uma janela em que a régua de vencimento não enxerga
      // o plano — e o aluno ficaria sem aviso, que é o que o D-083 proíbe.
      validUntil: deriveValidUntil({ validityDays, releaseAt, referenceAt: new Date() }),
      releaseAt,
      goal: input.goal ?? null,
      isFixed: input.isFixed ?? false,
      fixedWeekdays: input.fixedWeekdays ?? [],
    });
    return toPlanView(plan);
  }

  /**
   * D-079: N planos ATIVOS por vínculo — a lista não é "o plano do aluno", são
   * OS planos. Nenhum filtro implícito de unicidade.
   */
  async listPlans(
    authorization: string | undefined,
    tenantId: string,
    bondId: string,
    query: WorkoutPlanListQuery,
  ): Promise<WorkoutPlanSummaryView[]> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const plans = await this.workouts.listPlansByBond(tenantId, professionalProfileId, bondId, {
      status: query.status,
    });
    if (!plans) {
      throw new NotFoundError('Vinculo nao encontrado.');
    }
    return plans.map(toPlanView);
  }

  async getPlan(
    authorization: string | undefined,
    tenantId: string,
    planId: string,
  ): Promise<WorkoutPlanDetailView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const plan = await this.workouts.findPlanDetail(tenantId, professionalProfileId, planId);
    if (!plan) {
      throw new NotFoundError('Plano de treino nao encontrado.');
    }
    return toPlanDetailView(plan);
  }

  async updatePlan(
    authorization: string | undefined,
    tenantId: string,
    planId: string,
    input: WorkoutUpdatePlanInput,
  ): Promise<WorkoutPlanSummaryView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const current = await this.requireEditablePlan(tenantId, professionalProfileId, planId);

    const validityDays = input.validityDays ?? current.validityDays;
    const releaseAt =
      input.releaseAt === undefined ? current.releaseAt : parseDate(input.releaseAt);
    // Mexer em validade ou em liberação recalcula o vencimento: são as duas
    // entradas da fórmula do D-083, e deixar o `validUntil` velho ao lado de um
    // `validityDays` novo é justamente o estado divergente que a derivação evita.
    const recalculate = input.validityDays !== undefined || input.releaseAt !== undefined;

    const plan = await this.workouts.updatePlan(tenantId, professionalProfileId, planId, {
      title: input.title,
      organization: input.organization,
      validityDays: input.validityDays,
      releaseAt: input.releaseAt === undefined ? undefined : releaseAt,
      goal: input.goal,
      isFixed: input.isFixed,
      fixedWeekdays: input.fixedWeekdays,
      ...(recalculate
        ? { validUntil: deriveValidUntil({ validityDays, releaseAt, referenceAt: new Date() }) }
        : {}),
    });
    if (!plan) {
      throw new NotFoundError('Plano de treino nao encontrado.');
    }
    return toPlanView(plan);
  }

  /**
   * DRAFT -> SCHEDULED (há `releaseAt` futuro — D-084) ou ACTIVE (liberação
   * imediata). É aqui que o plano deixa de ser invisível ao aluno (D-165), e
   * por isso é aqui que os conjugados incompletos são barrados (D-082): o que
   * passa deste ponto é o que alguém vai executar na academia.
   *
   * O eixo ISSUED/CANCELLED do D-165 (fluxo do estagiário) NÃO é tocado aqui —
   * é slice futuro com mesa própria.
   */
  async releasePlan(
    authorization: string | undefined,
    tenantId: string,
    planId: string,
  ): Promise<WorkoutPlanSummaryView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const detail = await this.workouts.findPlanDetail(tenantId, professionalProfileId, planId);
    if (!detail) {
      throw new NotFoundError('Plano de treino nao encontrado.');
    }
    if (detail.status !== 'DRAFT') {
      throw new WorkoutPlanStateConflictError(
        `So um plano em DRAFT pode ser liberado; este esta ${detail.status}.`,
      );
    }

    for (const workout of detail.workouts) {
      assertSupersetGroupsComplete(
        workout.items.map((item) => ({
          id: item.id,
          supersetGroup: item.supersetGroup,
          setCount: item.sets.length,
        })),
      );
    }

    const releaseAt = detail.releaseAt;
    const now = new Date();
    const scheduled = releaseAt !== null && releaseAt.getTime() > now.getTime();
    const plan = await this.workouts.updatePlanStatus(
      tenantId,
      professionalProfileId,
      planId,
      scheduled ? 'SCHEDULED' : 'ACTIVE',
      // D-083: a validade conta de quando o plano PASSA A VALER — na liberação
      // imediata, é agora, não o instante em que o rascunho foi criado.
      deriveValidUntil({
        validityDays: detail.validityDays,
        releaseAt: scheduled ? releaseAt : null,
        referenceAt: now,
      }),
    );
    if (!plan) {
      throw new NotFoundError('Plano de treino nao encontrado.');
    }
    return toPlanView(plan);
  }

  /** Encerra o plano preservando o histórico (D-053/D-089) — nunca apaga. */
  async archivePlan(
    authorization: string | undefined,
    tenantId: string,
    planId: string,
  ): Promise<WorkoutPlanSummaryView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const plan = await this.workouts.updatePlanStatus(
      tenantId,
      professionalProfileId,
      planId,
      'ARCHIVED',
    );
    if (!plan) {
      throw new NotFoundError('Plano de treino nao encontrado.');
    }
    return toPlanView(plan);
  }

  /**
   * D-090 — clonagem para OUTRO vínculo. Os dois lados são verificados contra o
   * MESMO profissional: sem isso, "clonar" viraria um caminho de leitura para o
   * plano de um paciente de outra pessoa, o que o isolamento por vínculo
   * (ADR-0001) proíbe. A cópia nasce em DRAFT — chega como rascunho para ser
   * ajustada, não liberada por acidente para o aluno de destino.
   */
  async clonePlan(
    authorization: string | undefined,
    tenantId: string,
    planId: string,
    input: WorkoutClonePlanInput,
  ): Promise<WorkoutPlanSummaryView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const source = await this.workouts.findPlanContext(tenantId, professionalProfileId, planId);
    if (!source) {
      throw new NotFoundError('Plano de treino nao encontrado.');
    }
    const targetBond = await this.workouts.findBond(
      tenantId,
      professionalProfileId,
      input.targetBondId,
    );
    if (!targetBond) {
      throw new NotFoundError('Vinculo de destino nao encontrado.');
    }

    const plan = await this.workouts.clonePlan({
      tenantId,
      professionalProfileId,
      sourcePlanId: planId,
      targetBondId: input.targetBondId,
      title: input.title,
      // A cópia tem validade PRÓPRIA, contada de agora: herdar o `validUntil` da
      // origem entregaria ao aluno de destino um plano que já nasce vencido.
      validUntil: deriveValidUntil({
        validityDays: source.validityDays,
        releaseAt: null,
        referenceAt: new Date(),
      }),
    });
    if (!plan) {
      throw new NotFoundError('Plano de treino nao encontrado.');
    }
    return toPlanView(plan);
  }

  // ---- Treino ---------------------------------------------------------------

  async createWorkout(
    authorization: string | undefined,
    tenantId: string,
    planId: string,
    input: WorkoutCreateWorkoutInput,
  ): Promise<WorkoutView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const plan = await this.requireEditablePlan(tenantId, professionalProfileId, planId);

    const slot = resolveWorkoutSlot({
      organization: plan.organization,
      label: input.label ?? null,
      weekday: (input.weekday ?? null) as Weekday | null,
    });
    const workout = await this.workouts.createWorkout(tenantId, professionalProfileId, planId, {
      title: input.title,
      label: slot.label,
      weekday: slot.weekday,
      position: input.position ?? 0,
    });
    if (!workout) {
      throw new NotFoundError('Plano de treino nao encontrado.');
    }
    return toWorkoutView(workout);
  }

  async updateWorkout(
    authorization: string | undefined,
    tenantId: string,
    workoutId: string,
    input: WorkoutUpdateWorkoutInput,
  ): Promise<WorkoutView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const plan = await this.workouts.findWorkoutPlanContext(
      tenantId,
      professionalProfileId,
      workoutId,
    );
    if (!plan) {
      throw new NotFoundError('Treino nao encontrado.');
    }
    this.assertEditable(plan);

    // O slot só é revalidado quando o corpo mexe nele; um PATCH de título não
    // deve exigir que o cliente reenvie `label`/`weekday`.
    const touchesSlot = input.label !== undefined || input.weekday !== undefined;
    const workout = await this.workouts.updateWorkout(tenantId, professionalProfileId, workoutId, {
      title: input.title,
      position: input.position,
      ...(touchesSlot
        ? {
            slot: resolveWorkoutSlot({
              organization: plan.organization,
              label: input.label ?? null,
              weekday: (input.weekday ?? null) as Weekday | null,
            }),
          }
        : {}),
    });
    if (!workout) {
      throw new NotFoundError('Treino nao encontrado.');
    }
    return toWorkoutView(workout);
  }

  async deleteWorkout(
    authorization: string | undefined,
    tenantId: string,
    workoutId: string,
  ): Promise<void> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const deleted = await this.workouts.deleteWorkout(tenantId, professionalProfileId, workoutId);
    if (!deleted) {
      throw new NotFoundError('Treino nao encontrado.');
    }
  }

  // ---- Item (exercício do treino) -------------------------------------------

  async createItem(
    authorization: string | undefined,
    tenantId: string,
    workoutId: string,
    input: WorkoutCreateItemInput,
  ): Promise<WorkoutItemView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const plan = await this.workouts.findWorkoutPlanContext(
      tenantId,
      professionalProfileId,
      workoutId,
    );
    if (!plan) {
      throw new NotFoundError('Treino nao encontrado.');
    }
    this.assertEditable(plan);

    const item = await this.workouts.createItem(tenantId, professionalProfileId, workoutId, {
      exerciseId: input.exerciseId ?? null,
      position: input.position ?? 0,
      supersetGroup: input.supersetGroup ?? null,
      supersetOrder: input.supersetOrder ?? null,
      note: input.note ?? null,
    });
    if (!item) {
      throw new NotFoundError('Treino nao encontrado.');
    }
    return toItemView(item);
  }

  async updateItem(
    authorization: string | undefined,
    tenantId: string,
    itemId: string,
    input: WorkoutUpdateItemInput,
  ): Promise<WorkoutItemView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const context = await this.requireItemContext(tenantId, professionalProfileId, itemId);

    // Mover o item de grupo pode quebrar o conjugado de DESTINO (D-082) — a
    // invariante é conferida sobre o estado que RESULTARIA da mudança, não
    // sobre o atual.
    if (input.supersetGroup !== undefined) {
      assertSupersetSetCounts(
        applyToPeers(context, (peer) => ({ ...peer, supersetGroup: input.supersetGroup ?? null })),
      );
    }

    const item = await this.workouts.updateItem(tenantId, professionalProfileId, itemId, {
      exerciseId: input.exerciseId,
      position: input.position,
      supersetGroup: input.supersetGroup,
      supersetOrder: input.supersetOrder,
      note: input.note,
    });
    if (!item) {
      throw new NotFoundError('Item nao encontrado.');
    }
    return toItemView(item);
  }

  async deleteItem(
    authorization: string | undefined,
    tenantId: string,
    itemId: string,
  ): Promise<void> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const deleted = await this.workouts.deleteItem(tenantId, professionalProfileId, itemId);
    if (!deleted) {
      throw new NotFoundError('Item nao encontrado.');
    }
  }

  /**
   * D-081 — troca a lista COMPLETA de séries do item. A posição de cada série é
   * o índice na lista; num conjugado, é o índice da RODADA (D-082).
   */
  async replaceSets(
    authorization: string | undefined,
    tenantId: string,
    itemId: string,
    input: WorkoutReplaceSetsInput,
  ): Promise<WorkoutItemView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const context = await this.requireItemContext(tenantId, professionalProfileId, itemId);

    assertSupersetSetCounts(
      applyToPeers(context, (peer) => ({ ...peer, setCount: input.sets.length })),
    );

    const sets: WorkoutSetInputRecord[] = input.sets.map((set) => ({
      reps: set.reps ?? null,
      repsToFailure: set.repsToFailure ?? false,
      weightGrams: set.weightGrams ?? null,
      durationSeconds: set.durationSeconds ?? null,
      distanceMeters: set.distanceMeters ?? null,
      bodyweight: set.bodyweight ?? false,
      restSeconds: set.restSeconds ?? null,
      technique: set.technique ?? 'NORMAL',
      note: set.note ?? null,
    }));

    const item = await this.workouts.replaceSets(tenantId, professionalProfileId, itemId, sets);
    if (!item) {
      throw new NotFoundError('Item nao encontrado.');
    }
    return toItemView(item);
  }

  // ---- Superfície do ALUNO --------------------------------------------------

  /**
   * D-165 — o aluno NUNCA vê DRAFT: plano em montagem não existe para quem vai
   * executar. Sem `:tenantId` no path de propósito (mesmo padrão de
   * `/v1/consents`): o paciente é a PESSOA, e o vínculo é que diz em que tenant
   * cada plano dele vive.
   */
  async listMyPlans(authorization: string | undefined): Promise<WorkoutPlanSummaryView[]> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const patient = await this.workouts.findPatientProfile(ctx.accountId);
    if (!patient) {
      throw new ForbiddenError('Requer um perfil de paciente.');
    }
    const plans = await this.workouts.listPlansForPatient(patient.patientProfileId);
    return plans.map(toPlanView);
  }

  // ---- Guards ---------------------------------------------------------------

  /** Guard base: Bearer válido + perfil profissional NESTE tenant (D-002). */
  private async requireProfessional(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<{ professionalProfileId: string }> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const professional = await this.workouts.findProfessional(ctx.accountId, tenantId);
    if (!professional) {
      throw new ForbiddenError('Requer um perfil profissional neste tenant.');
    }
    return professional;
  }

  /** Guard do vínculo: além de profissional do tenant, deve ser o dono do bond. */
  private async requireBond(
    authorization: string | undefined,
    tenantId: string,
    bondId: string,
  ): Promise<{ professionalProfileId: string }> {
    const professional = await this.requireProfessional(authorization, tenantId);
    const bond = await this.workouts.findBond(tenantId, professional.professionalProfileId, bondId);
    if (!bond) {
      throw new NotFoundError('Vinculo nao encontrado.');
    }
    return professional;
  }

  private async requireEditablePlan(
    tenantId: string,
    professionalProfileId: string,
    planId: string,
  ): Promise<WorkoutPlanContext> {
    const plan = await this.workouts.findPlanContext(tenantId, professionalProfileId, planId);
    if (!plan) {
      throw new NotFoundError('Plano de treino nao encontrado.');
    }
    this.assertEditable(plan);
    return plan;
  }

  private assertEditable(plan: WorkoutPlanContext): void {
    if (!EDITABLE_PLAN_STATUSES.includes(plan.status)) {
      throw new WorkoutPlanStateConflictError(
        `Plano ${plan.status} nao aceita alteracao de prescricao (D-053 — historico preservado).`,
      );
    }
  }

  private async requireItemContext(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
  ): Promise<WorkoutItemContext> {
    const context = await this.workouts.findItemContext(tenantId, professionalProfileId, itemId);
    if (!context) {
      throw new NotFoundError('Item nao encontrado.');
    }
    return context;
  }
}

/** Projeta os irmãos do item aplicando a mudança pendente só ao próprio item. */
function applyToPeers(
  context: WorkoutItemContext,
  change: (peer: SupersetPeer) => SupersetPeer,
): SupersetPeer[] {
  return context.peers.map((peer) => (peer.id === context.id ? change(peer) : peer));
}

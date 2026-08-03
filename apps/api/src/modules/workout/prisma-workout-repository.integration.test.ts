import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@fitvo/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { WorkoutPlanStateConflictError } from '../../shared/http-errors';
import { PrismaWorkoutRepository } from './prisma-workout-repository';
import type { WorkoutSetInputRecord } from './workout-repository';

/**
 * Integracao — PRESCRICAO DE TREINO (ADR-0009, Bloco 2) contra Postgres real.
 *
 * O double in-memory reproduz as regras, mas so o banco prova o que importa
 * aqui:
 * - o ESCOPO e uma clausula SQL com dois eixos (`tenantId` proprio + join no
 *   `bond`), e "o plano do paciente de A nao vaza para B" e afirmacao sobre
 *   essa clausula — nao sobre um `if` em TypeScript;
 * - a SERIE-LINHA (D-081) so e serie-linha se o banco guardar 3 LINHAS com
 *   valores distintos, e a carga tipada so nao se mistura se as colunas
 *   nao-usadas ficarem NULAS de verdade;
 * - a CLONAGEM (D-090) e uma transacao que cria dezenas de linhas em cascata:
 *   "copia profunda" e afirmacao sobre o que sobrou no banco;
 * - o ROLLBACK de `replaceSets` so existe se a transacao existir.
 *
 * Usa `PrismaClient` CRU (sem a extension de isolamento) de proposito: o objeto
 * do teste e o PREDICADO DO REPOSITORIO. Com a extension ligada, um predicado
 * furado passaria escondido atras do filtro dela — e a defesa em profundidade
 * (D-166) so vale se as duas camadas estiverem inteiras, nao se uma cobrir o
 * buraco da outra. A prova de que a extension tambem escopa vive no
 * `tenant-isolation-extension.integration.test.ts`; a prova do pipeline HTTP
 * completo, no `tenant-isolation-premise.integration.test.ts`.
 */

const prisma = new PrismaClient();
const repo = new PrismaWorkoutRepository(prisma);

let specialtyId = '';

beforeAll(async () => {
  const specialty = await prisma.specialty.findFirstOrThrow({ where: { code: 'TRAINING' } });
  specialtyId = specialty.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

interface Scenario {
  tenantId: string;
  professionalProfileId: string;
  patientProfileId: string;
  bondId: string;
}

/**
 * Tenant + profissional + paciente + vinculo reais. O banco e compartilhado
 * entre execucoes: tudo sufixado para nao colidir.
 */
async function seedScenario(label: string): Promise<Scenario> {
  const id = `${label}-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({ data: { type: 'CLINIC', name: `Tenant ${id}` } });

  const professional = await prisma.account.create({
    data: {
      email: `wk-pro-${id}@e2e.dev`,
      passwordHash: 'x',
      name: `Pro ${id}`,
      document: '00000000000',
      documentType: 'CPF',
      professionalProfile: { create: { tenantId: tenant.id } },
    },
    select: { professionalProfile: { select: { id: true } } },
  });

  const patient = await prisma.account.create({
    data: {
      email: `wk-pac-${id}@e2e.dev`,
      passwordHash: 'x',
      name: `Paciente ${id}`,
      document: '00000000001',
      documentType: 'CPF',
      patientProfile: { create: {} },
    },
    select: { patientProfile: { select: { id: true } } },
  });

  const bond = await prisma.bond.create({
    data: {
      tenantId: tenant.id,
      patientProfileId: patient.patientProfile!.id,
      professionalProfileId: professional.professionalProfile!.id,
      specialtyId,
      modality: 'ONLINE',
    },
    select: { id: true },
  });

  return {
    tenantId: tenant.id,
    professionalProfileId: professional.professionalProfile!.id,
    patientProfileId: patient.patientProfile!.id,
    bondId: bond.id,
  };
}

/** Segundo vinculo do MESMO profissional (outro aluno) — destino da clonagem. */
async function seedSecondBond(scenario: Scenario, label: string): Promise<string> {
  const id = `${label}-${randomUUID().slice(0, 8)}`;
  const patient = await prisma.account.create({
    data: {
      email: `wk-pac2-${id}@e2e.dev`,
      passwordHash: 'x',
      name: `Paciente 2 ${id}`,
      document: '00000000002',
      documentType: 'CPF',
      patientProfile: { create: {} },
    },
    select: { patientProfile: { select: { id: true } } },
  });
  const bond = await prisma.bond.create({
    data: {
      tenantId: scenario.tenantId,
      patientProfileId: patient.patientProfile!.id,
      professionalProfileId: scenario.professionalProfileId,
      specialtyId,
      modality: 'ONLINE',
    },
    select: { id: true },
  });
  return bond.id;
}

function createPlan(scenario: Scenario, overrides: Record<string, unknown> = {}) {
  return repo.createPlan({
    tenantId: scenario.tenantId,
    bondId: scenario.bondId,
    title: 'Musculacao Julho',
    organization: 'LETTER',
    validityDays: 30,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    releaseAt: null,
    goal: null,
    isFixed: false,
    fixedWeekdays: [],
    ...overrides,
  });
}

/** Serie de peso pronta — o formato de `WorkoutSetInputRecord` inteiro. */
function weightSet(overrides: Partial<WorkoutSetInputRecord> = {}): WorkoutSetInputRecord {
  return {
    reps: 12,
    repsToFailure: false,
    weightGrams: 20_000,
    durationSeconds: null,
    distanceMeters: null,
    bodyweight: false,
    restSeconds: 60,
    technique: 'NORMAL',
    note: null,
    ...overrides,
  };
}

/** Plano -> treino A -> item, no banco. */
async function seedPlanWithItem(scenario: Scenario): Promise<{
  planId: string;
  workoutId: string;
  itemId: string;
}> {
  const plan = await createPlan(scenario);
  const workout = await repo.createWorkout(
    scenario.tenantId,
    scenario.professionalProfileId,
    plan.id,
    { title: 'Treino A', label: 'A', weekday: null, position: 0 },
  );
  const item = await repo.createItem(
    scenario.tenantId,
    scenario.professionalProfileId,
    workout!.id,
    { exerciseId: null, position: 0, supersetGroup: null, supersetOrder: null, note: null },
  );
  return { planId: plan.id, workoutId: workout!.id, itemId: item!.id };
}

describe('PrismaWorkoutRepository — prescricao contra Postgres real', () => {
  describe('D-081 — serie-linha e carga tipada', () => {
    it('tres series DIFERENTES do mesmo exercicio viram TRES LINHAS distintas', async () => {
      const scenario = await seedScenario('serie');
      const { itemId } = await seedPlanWithItem(scenario);

      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, itemId, [
        weightSet({ reps: 12, weightGrams: 20_000, restSeconds: 60 }),
        weightSet({ reps: 10, weightGrams: 25_000, restSeconds: 90 }),
        weightSet({
          reps: null,
          repsToFailure: true,
          weightGrams: 25_000,
          restSeconds: 90,
          technique: 'DROP_SET',
        }),
      ]);

      // Lido do BANCO, nao do retorno do repositorio.
      const rows = await prisma.workoutSet.findMany({
        where: { workoutItemId: itemId },
        orderBy: { position: 'asc' },
      });
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
      // Nenhuma serie e copia da outra — e o que "3x12" nao consegue expressar.
      expect(rows.map((r) => r.reps)).toEqual([12, 10, null]);
      expect(rows.map((r) => r.weightGrams)).toEqual([20_000, 25_000, 25_000]);
      expect(rows.map((r) => r.repsToFailure)).toEqual([false, false, true]);
      expect(rows.map((r) => r.technique)).toEqual(['NORMAL', 'NORMAL', 'DROP_SET']);
    });

    it('carga TIPADA nao se mistura: as colunas nao usadas ficam NULAS no banco', async () => {
      const scenario = await seedScenario('tipada');
      const { itemId } = await seedPlanWithItem(scenario);

      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, itemId, [
        weightSet({ reps: 10, weightGrams: 30_000 }),
        weightSet({ reps: null, weightGrams: null, durationSeconds: 60, restSeconds: null }),
        weightSet({ reps: null, weightGrams: null, distanceMeters: 1_000, restSeconds: null }),
        weightSet({ reps: null, repsToFailure: true, weightGrams: null, bodyweight: true }),
      ]);

      const rows = await prisma.workoutSet.findMany({
        where: { workoutItemId: itemId },
        orderBy: { position: 'asc' },
      });

      // O ponto do D-081: uma agregacao de "evolucao de carga" (D-092) que some
      // `weightGrams` NUNCA encosta em segundos ou metros, porque eles moram em
      // colunas proprias e a coluna de peso e NULA nessas linhas.
      expect(rows[0]).toMatchObject({
        weightGrams: 30_000,
        durationSeconds: null,
        distanceMeters: null,
        bodyweight: false,
      });
      expect(rows[1]).toMatchObject({
        weightGrams: null,
        durationSeconds: 60,
        distanceMeters: null,
      });
      expect(rows[2]).toMatchObject({
        weightGrams: null,
        durationSeconds: null,
        distanceMeters: 1_000,
      });
      expect(rows[3]).toMatchObject({ weightGrams: null, bodyweight: true, durationSeconds: null });

      const somaDePeso = rows.reduce((total, row) => total + (row.weightGrams ?? 0), 0);
      expect(somaDePeso).toBe(30_000);
    });

    it('a substituicao e TRANSACIONAL: um lote invalido nao deixa a lista pela metade', async () => {
      const scenario = await seedScenario('rollback');
      const { itemId } = await seedPlanWithItem(scenario);

      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, itemId, [
        weightSet({ reps: 12 }),
        weightSet({ reps: 10 }),
      ]);

      // Duas series validas seguidas de uma que o BANCO recusa (posicao
      // duplicada viola @@unique([workoutItemId, position])). Forjada via
      // `createMany` dentro da mesma transacao do repositorio: o objetivo e
      // provar que a falha reverte o delete das antigas tambem.
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.workoutSet.deleteMany({ where: { workoutItemId: itemId } });
          await tx.workoutSet.createMany({
            data: [
              { tenantId: scenario.tenantId, workoutItemId: itemId, position: 0, reps: 5 },
              { tenantId: scenario.tenantId, workoutItemId: itemId, position: 0, reps: 6 },
            ],
          });
        }),
      ).rejects.toThrow();

      // As DUAS series originais continuam la — nada foi apagado pela metade.
      const rows = await prisma.workoutSet.findMany({
        where: { workoutItemId: itemId },
        orderBy: { position: 'asc' },
      });
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.reps)).toEqual([12, 10]);
    });

    it('substituir troca a lista inteira e nao deixa serie orfa', async () => {
      const scenario = await seedScenario('troca');
      const { itemId } = await seedPlanWithItem(scenario);

      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, itemId, [
        weightSet(),
        weightSet(),
        weightSet(),
      ]);
      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, itemId, [
        weightSet({ reps: 8, weightGrams: 40_000 }),
      ]);

      const rows = await prisma.workoutSet.findMany({ where: { workoutItemId: itemId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ position: 0, reps: 8, weightGrams: 40_000 });
    });

    it('a serie grava o tenantId proprio (D-166) — a extension tem o que filtrar', async () => {
      const scenario = await seedScenario('tenantset');
      const { itemId } = await seedPlanWithItem(scenario);
      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, itemId, [
        weightSet(),
      ]);

      const row = await prisma.workoutSet.findFirstOrThrow({ where: { workoutItemId: itemId } });
      const item = await prisma.workoutItem.findUniqueOrThrow({ where: { id: itemId } });
      expect(row.tenantId).toBe(scenario.tenantId);
      expect(item.tenantId).toBe(scenario.tenantId);
    });
  });

  describe('D-090 — clonagem profunda', () => {
    it('copia plano -> treinos -> itens -> series para OUTRO vinculo, com registros proprios', async () => {
      const scenario = await seedScenario('clone');
      const targetBondId = await seedSecondBond(scenario, 'clone');

      const plan = await createPlan(scenario, { title: 'Plano do Joao' });
      const workoutA = await repo.createWorkout(
        scenario.tenantId,
        scenario.professionalProfileId,
        plan.id,
        { title: 'Treino A', label: 'A', weekday: null, position: 0 },
      );
      const workoutB = await repo.createWorkout(
        scenario.tenantId,
        scenario.professionalProfileId,
        plan.id,
        { title: 'Treino B', label: 'B', weekday: null, position: 1 },
      );
      const item = await repo.createItem(
        scenario.tenantId,
        scenario.professionalProfileId,
        workoutA!.id,
        {
          exerciseId: null,
          position: 0,
          supersetGroup: 1,
          supersetOrder: 0,
          note: 'cadencia 3-1-1',
        },
      );
      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, item!.id, [
        weightSet({ reps: 12, weightGrams: 20_000 }),
        weightSet({ reps: null, repsToFailure: true, weightGrams: 25_000, technique: 'DROP_SET' }),
      ]);

      const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const copy = await repo.clonePlan({
        tenantId: scenario.tenantId,
        professionalProfileId: scenario.professionalProfileId,
        sourcePlanId: plan.id,
        targetBondId,
        title: 'Copia para a Maria',
        validUntil,
      });

      expect(copy).not.toBeNull();
      expect(copy!.bondId).toBe(targetBondId);
      expect(copy!.id).not.toBe(plan.id);
      // LINHAGEM registrada como DADO, sem relation (D-090) — ponteiro de
      // auditoria, nunca um join que alcance o vinculo de origem.
      expect(copy!.clonedFromWorkoutPlanId).toBe(plan.id);
      // A copia chega como rascunho — nao liberada ao aluno de destino por acidente.
      expect(copy!.status).toBe('DRAFT');
      // Validade PROPRIA, contada de agora: nao herda um vencimento ja corrido.
      expect(copy!.validUntil?.toISOString()).toBe(validUntil.toISOString());

      // PROFUNDA: a arvore inteira existe no destino, em LINHAS NOVAS.
      const copied = await repo.findPlanDetail(
        scenario.tenantId,
        scenario.professionalProfileId,
        copy!.id,
      );
      expect(copied!.workouts).toHaveLength(2);
      expect(copied!.workouts.map((w) => w.title)).toEqual(['Treino A', 'Treino B']);
      expect(copied!.workouts.map((w) => w.id)).not.toContain(workoutA!.id);
      expect(copied!.workouts.map((w) => w.id)).not.toContain(workoutB!.id);

      const copiedItem = copied!.workouts[0]!.items[0]!;
      expect(copiedItem.id).not.toBe(item!.id);
      expect(copiedItem.supersetGroup).toBe(1);
      expect(copiedItem.note).toBe('cadencia 3-1-1');
      expect(copiedItem.sets).toHaveLength(2);
      expect(copiedItem.sets.map((s) => s.weightGrams)).toEqual([20_000, 25_000]);
      expect(copiedItem.sets[1]).toMatchObject({ repsToFailure: true, technique: 'DROP_SET' });
      expect(copiedItem.sets.map((s) => s.id)).not.toContain(
        (await prisma.workoutSet.findFirstOrThrow({ where: { workoutItemId: item!.id } })).id,
      );

      // A ORIGEM fica intacta: clonar e copiar, nao mover.
      const original = await repo.findPlanDetail(
        scenario.tenantId,
        scenario.professionalProfileId,
        plan.id,
      );
      expect(original!.workouts[0]!.items[0]!.sets).toHaveLength(2);
      expect(original!.clonedFromWorkoutPlanId).toBeNull();
      expect(original!.bondId).toBe(scenario.bondId);
    });

    it('a clonagem NAO leva execucao junto — a sessao do aluno de origem nao vira a do destino', async () => {
      const scenario = await seedScenario('exec');
      const targetBondId = await seedSecondBond(scenario, 'exec');
      const { planId, workoutId, itemId } = await seedPlanWithItem(scenario);
      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, itemId, [
        weightSet(),
      ]);

      // Execucao REAL na origem (o Bloco 3 nao existe ainda; o dado e semeado
      // direto para provar que a clonagem o ignora).
      const session = await prisma.workoutSession.create({
        data: {
          tenantId: scenario.tenantId,
          bondId: scenario.bondId,
          workoutId,
          planId,
          status: 'COMPLETED',
          performedAt: new Date(),
          completedAt: new Date(),
        },
      });
      const prescribedSet = await prisma.workoutSet.findFirstOrThrow({
        where: { workoutItemId: itemId },
      });
      await prisma.setLog.create({
        data: {
          tenantId: scenario.tenantId,
          sessionId: session.id,
          workoutSetId: prescribedSet.id,
          done: true,
          actualReps: 11,
          actualWeightGrams: 19_000,
        },
      });

      const copy = await repo.clonePlan({
        tenantId: scenario.tenantId,
        professionalProfileId: scenario.professionalProfileId,
        sourcePlanId: planId,
        targetBondId,
        title: undefined,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Nenhuma sessao nasceu no vinculo de destino.
      const sessionsNoDestino = await prisma.workoutSession.count({
        where: { bondId: targetBondId },
      });
      expect(sessionsNoDestino).toBe(0);

      // E nenhum SetLog aponta para as series copiadas.
      const copiedSets = await prisma.workoutSet.findMany({
        where: { workoutItem: { workout: { planId: copy!.id } } },
        select: { id: true },
      });
      expect(copiedSets.length).toBeGreaterThan(0);
      const logsNasCopias = await prisma.setLog.count({
        where: { workoutSetId: { in: copiedSets.map((s) => s.id) } },
      });
      expect(logsNasCopias).toBe(0);

      // A execucao da origem continua intacta.
      expect(await prisma.setLog.count({ where: { sessionId: session.id } })).toBe(1);
    });

    it('recusa clonar plano que nao e do profissional', async () => {
      const dono = await seedScenario('donoclone');
      const intruso = await seedScenario('intrusoclone');
      const { planId } = await seedPlanWithItem(dono);

      const copy = await repo.clonePlan({
        tenantId: intruso.tenantId,
        professionalProfileId: intruso.professionalProfileId,
        sourcePlanId: planId,
        targetBondId: intruso.bondId,
        title: undefined,
        validUntil: new Date(),
      });
      expect(copy).toBeNull();
      expect(await prisma.workoutPlan.count({ where: { bondId: intruso.bondId } })).toBe(0);
    });
  });

  describe('D-100 — prescricao ja executada nao se apaga', () => {
    it('trocar as series de um item COM execucao registrada e recusado', async () => {
      const scenario = await seedScenario('executado');
      const { planId, workoutId, itemId } = await seedPlanWithItem(scenario);
      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, itemId, [
        weightSet(),
      ]);

      const session = await prisma.workoutSession.create({
        data: {
          tenantId: scenario.tenantId,
          bondId: scenario.bondId,
          workoutId,
          planId,
          status: 'COMPLETED',
          performedAt: new Date(),
        },
      });
      const prescribedSet = await prisma.workoutSet.findFirstOrThrow({
        where: { workoutItemId: itemId },
      });
      await prisma.setLog.create({
        data: {
          tenantId: scenario.tenantId,
          sessionId: session.id,
          workoutSetId: prescribedSet.id,
          done: true,
        },
      });

      await expect(
        repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, itemId, [
          weightSet({ reps: 8 }),
        ]),
      ).rejects.toThrow(WorkoutPlanStateConflictError);

      // A serie executada continua exatamente onde estava.
      const rows = await prisma.workoutSet.findMany({ where: { workoutItemId: itemId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(prescribedSet.id);
      expect(rows[0]!.reps).toBe(12);
    });
  });

  describe('escopo por vinculo e por tenant (D-079/D-166)', () => {
    it('profissional de OUTRO tenant nao le o plano nem por id direto', async () => {
      const dono = await seedScenario('escopoA');
      const outro = await seedScenario('escopoB');
      const { planId, workoutId, itemId } = await seedPlanWithItem(dono);

      // Com o tenant dele (predicado bate no tenantId, falha no bond).
      expect(
        await repo.findPlanDetail(outro.tenantId, outro.professionalProfileId, planId),
      ).toBeNull();
      // Com o tenant do DONO no path (falha no professionalProfileId do bond) —
      // o caso que a extension sozinha nao pegaria.
      expect(
        await repo.findPlanDetail(dono.tenantId, outro.professionalProfileId, planId),
      ).toBeNull();
      // E com o proprio profissional do dono, mas apontando outro tenant.
      expect(
        await repo.findPlanDetail(outro.tenantId, dono.professionalProfileId, planId),
      ).toBeNull();

      expect(
        await repo.findWorkoutPlanContext(dono.tenantId, outro.professionalProfileId, workoutId),
      ).toBeNull();
      expect(
        await repo.findItemContext(dono.tenantId, outro.professionalProfileId, itemId),
      ).toBeNull();

      // Controle: o dono le normalmente.
      expect(
        (await repo.findPlanDetail(dono.tenantId, dono.professionalProfileId, planId))?.id,
      ).toBe(planId);
    });

    it('ESCRITA cross-tenant nao muda uma linha sequer', async () => {
      const dono = await seedScenario('escritaA');
      const outro = await seedScenario('escritaB');
      const { planId, workoutId, itemId } = await seedPlanWithItem(dono);
      await repo.replaceSets(dono.tenantId, dono.professionalProfileId, itemId, [weightSet()]);

      expect(
        await repo.updatePlan(dono.tenantId, outro.professionalProfileId, planId, {
          title: 'Invadido',
        }),
      ).toBeNull();
      expect(
        await repo.updatePlanStatus(dono.tenantId, outro.professionalProfileId, planId, 'ARCHIVED'),
      ).toBeNull();
      expect(
        await repo.updateWorkout(dono.tenantId, outro.professionalProfileId, workoutId, {
          title: 'Invadido',
        }),
      ).toBeNull();
      expect(
        await repo.updateItem(dono.tenantId, outro.professionalProfileId, itemId, { position: 99 }),
      ).toBeNull();
      expect(
        await repo.replaceSets(dono.tenantId, outro.professionalProfileId, itemId, []),
      ).toBeNull();
      expect(await repo.deleteWorkout(dono.tenantId, outro.professionalProfileId, workoutId)).toBe(
        false,
      );
      expect(await repo.deleteItem(dono.tenantId, outro.professionalProfileId, itemId)).toBe(false);

      // Nada mudou: titulo, status, e a serie continuam como estavam.
      const plan = await prisma.workoutPlan.findUniqueOrThrow({ where: { id: planId } });
      expect(plan.title).toBe('Musculacao Julho');
      expect(plan.status).toBe('DRAFT');
      expect(await prisma.workoutSet.count({ where: { workoutItemId: itemId } })).toBe(1);
      expect(
        (await prisma.workout.findUniqueOrThrow({ where: { id: workoutId } })).deletedAt,
      ).toBeNull();
    });

    it('listar planos de vinculo alheio devolve null (404), nao lista vazia', async () => {
      const dono = await seedScenario('listaA');
      const outro = await seedScenario('listaB');
      await seedPlanWithItem(dono);

      expect(
        await repo.listPlansByBond(dono.tenantId, outro.professionalProfileId, dono.bondId, {}),
      ).toBeNull();
      expect(
        await repo.listPlansByBond(dono.tenantId, dono.professionalProfileId, dono.bondId, {}),
      ).toHaveLength(1);
    });

    it('D-079: N planos ATIVOS convivem no mesmo vinculo', async () => {
      const scenario = await seedScenario('nplanos');
      const musculacao = await createPlan(scenario, { title: 'Musculacao Julho' });
      const cardio = await createPlan(scenario, { title: 'Cardio Julho' });
      for (const plan of [musculacao, cardio]) {
        await repo.updatePlanStatus(
          scenario.tenantId,
          scenario.professionalProfileId,
          plan.id,
          'ACTIVE',
        );
      }

      const ativos = await repo.listPlansByBond(
        scenario.tenantId,
        scenario.professionalProfileId,
        scenario.bondId,
        { status: 'ACTIVE' },
      );
      expect(ativos).toHaveLength(2);
    });
  });

  describe('D-105 — plano fixo persistido', () => {
    it('grava isFixed e os dias escolhidos; o plano variavel nasce sem nenhum', async () => {
      const scenario = await seedScenario('fixo');
      const fixo = await createPlan(scenario, {
        title: 'Mobilidade diaria',
        isFixed: true,
        fixedWeekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      });
      const variavel = await createPlan(scenario, { title: 'Musculacao' });

      const rowFixo = await prisma.workoutPlan.findUniqueOrThrow({ where: { id: fixo.id } });
      const rowVariavel = await prisma.workoutPlan.findUniqueOrThrow({
        where: { id: variavel.id },
      });

      expect(rowFixo.isFixed).toBe(true);
      expect(rowFixo.fixedWeekdays).toEqual(['MONDAY', 'WEDNESDAY', 'FRIDAY']);
      expect(rowVariavel.isFixed).toBe(false);
      expect(rowVariavel.fixedWeekdays).toEqual([]);
    });
  });

  describe('D-165 — visibilidade do aluno', () => {
    it('o aluno nunca ve DRAFT, e so ve os planos dos vinculos DELE', async () => {
      const scenario = await seedScenario('aluno');
      const outro = await seedScenario('alunooutro');

      const rascunho = await createPlan(scenario, { title: 'Rascunho' });
      const liberado = await createPlan(scenario, { title: 'Liberado' });
      await repo.updatePlanStatus(
        scenario.tenantId,
        scenario.professionalProfileId,
        liberado.id,
        'ACTIVE',
      );
      await createPlan(outro, { title: 'De outro aluno' });

      const visiveis = await repo.listPlansForPatient(scenario.patientProfileId);
      const ids = visiveis.map((plan) => plan.id);
      expect(ids).toContain(liberado.id);
      // Plano em montagem NAO existe para quem vai executar.
      expect(ids).not.toContain(rascunho.id);
      expect(visiveis).toHaveLength(1);
    });
  });

  describe('D-089 — delecao logica', () => {
    it('remover treino tombstonea a arvore inteira sem apagar linha nenhuma', async () => {
      const scenario = await seedScenario('tombstone');
      const { planId, workoutId, itemId } = await seedPlanWithItem(scenario);
      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, itemId, [
        weightSet(),
        weightSet(),
      ]);

      expect(
        await repo.deleteWorkout(scenario.tenantId, scenario.professionalProfileId, workoutId),
      ).toBe(true);

      // As LINHAS continuam no banco — deletar aqui e marcar, nunca destruir.
      expect(await prisma.workout.count({ where: { id: workoutId } })).toBe(1);
      expect(await prisma.workoutItem.count({ where: { id: itemId } })).toBe(1);
      expect(await prisma.workoutSet.count({ where: { workoutItemId: itemId } })).toBe(2);

      // Mas somem de toda leitura, em cascata (pai, filho e neto).
      const detail = await repo.findPlanDetail(
        scenario.tenantId,
        scenario.professionalProfileId,
        planId,
      );
      expect(detail!.workouts).toHaveLength(0);
      expect(
        await repo.findItemContext(scenario.tenantId, scenario.professionalProfileId, itemId),
      ).toBeNull();

      // A CASCATA e afirmada sobre CADA linha, nao so sobre o efeito visivel do
      // pai: filtrar pelo `workout` morto ja esconderia um item vivo orfao das
      // leituras que entram por cima — e ele voltaria a aparecer na hora em que
      // alguem consultar o item direto (o pull do sync, D-099, faz exatamente
      // isso). Sem estes asserts, remover a marcacao do filho passa despercebido.
      expect(
        (await prisma.workout.findUniqueOrThrow({ where: { id: workoutId } })).deletedAt,
      ).not.toBeNull();
      expect(
        (await prisma.workoutItem.findUniqueOrThrow({ where: { id: itemId } })).deletedAt,
      ).not.toBeNull();
      const setRows = await prisma.workoutSet.findMany({ where: { workoutItemId: itemId } });
      expect(setRows).toHaveLength(2);
      expect(setRows.every((row) => row.deletedAt !== null)).toBe(true);
    });
  });

  describe('D-082 — contexto do conjugado vem do banco', () => {
    it('findItemContext traz os irmaos com a contagem REAL de series', async () => {
      const scenario = await seedScenario('conjugado');
      const { workoutId, itemId } = await seedPlanWithItem(scenario);

      const par = await repo.createItem(
        scenario.tenantId,
        scenario.professionalProfileId,
        workoutId,
        { exerciseId: null, position: 1, supersetGroup: 1, supersetOrder: 1, note: null },
      );
      await repo.updateItem(scenario.tenantId, scenario.professionalProfileId, itemId, {
        supersetGroup: 1,
        supersetOrder: 0,
      });
      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, itemId, [
        weightSet(),
        weightSet(),
        weightSet(),
      ]);
      await repo.replaceSets(scenario.tenantId, scenario.professionalProfileId, par!.id, [
        weightSet(),
        weightSet(),
      ]);

      const context = await repo.findItemContext(
        scenario.tenantId,
        scenario.professionalProfileId,
        itemId,
      );
      expect(context!.peers).toHaveLength(2);
      const counts = new Map(context!.peers.map((peer) => [peer.id, peer.setCount]));
      expect(counts.get(itemId)).toBe(3);
      expect(counts.get(par!.id)).toBe(2);
      expect(context!.peers.every((peer) => peer.supersetGroup === 1)).toBe(true);
    });
  });
});

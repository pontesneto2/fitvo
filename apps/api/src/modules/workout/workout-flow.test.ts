import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';
import { validProfessionalRegistration } from '../../testing/professional-registration-fixture';

const TENANT_A = 'wk_tenant_a';
const TENANT_B = 'wk_tenant_b';

const proPayload = {
  ...validProfessionalRegistration,
  name: 'Personal',
  specialtyId: 'spec_training',
  councilDocument: 'CREF-123456',
};

interface Actor {
  token: string;
  professionalProfileId: string;
  bondId: string;
  patientProfileId: string;
}

/**
 * Registra um profissional (via auth) e semeia perfil + vinculo no repositorio
 * de treino (in-memory, isolado das demais slices — cada uma semeia o proprio
 * mundo). Devolve token e ids para montar as rotas do teste.
 */
async function setupProfessional(
  harness: TestHarness,
  tenantId: string,
  email: string,
): Promise<Actor> {
  const res = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: { ...proPayload, email },
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  await harness.accounts.markEmailVerified(body.account.id);
  const professionalProfileId = harness.workout.seedProfessional({
    accountId: body.account.id,
    tenantId,
  });
  const patientProfileId = harness.workout.seedPatient({ accountId: `acc_${email}` });
  const bondId = harness.workout.seedBond({ tenantId, professionalProfileId, patientProfileId });
  return { token: body.tokens.accessToken, professionalProfileId, bondId, patientProfileId };
}

function createPlan(
  app: FastifyInstance,
  tenantId: string,
  bondId: string,
  token: string,
  body: Record<string, unknown> = { title: 'Musculacao Julho', organization: 'LETTER' },
) {
  return app.inject({
    method: 'POST',
    url: `/v1/workout/${tenantId}/bonds/${bondId}/plans`,
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  });
}

function createWorkout(
  app: FastifyInstance,
  tenantId: string,
  planId: string,
  token: string,
  body: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: `/v1/workout/${tenantId}/plans/${planId}/workouts`,
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  });
}

function createItem(
  app: FastifyInstance,
  tenantId: string,
  workoutId: string,
  token: string,
  body: Record<string, unknown> = {},
) {
  return app.inject({
    method: 'POST',
    url: `/v1/workout/${tenantId}/workouts/${workoutId}/items`,
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  });
}

function putSets(
  app: FastifyInstance,
  tenantId: string,
  itemId: string,
  token: string,
  sets: Record<string, unknown>[],
) {
  return app.inject({
    method: 'PUT',
    url: `/v1/workout/${tenantId}/items/${itemId}/sets`,
    headers: { authorization: `Bearer ${token}` },
    payload: { sets },
  });
}

function getPlan(app: FastifyInstance, tenantId: string, planId: string, token: string) {
  return app.inject({
    method: 'GET',
    url: `/v1/workout/${tenantId}/plans/${planId}`,
    headers: { authorization: `Bearer ${token}` },
  });
}

/** Monta plano LETTER -> treino A -> um item, e devolve os ids. */
async function seedPlanWithItem(
  harness: TestHarness,
  actor: Actor,
  tenantId = TENANT_A,
): Promise<{ planId: string; workoutId: string; itemId: string }> {
  const plan = await createPlan(harness.app, tenantId, actor.bondId, actor.token);
  expect(plan.statusCode).toBe(201);
  const planId = plan.json().id as string;

  const workout = await createWorkout(harness.app, tenantId, planId, actor.token, {
    title: 'Treino A',
    label: 'A',
  });
  expect(workout.statusCode).toBe(201);
  const workoutId = workout.json().id as string;

  const item = await createItem(harness.app, tenantId, workoutId, actor.token);
  expect(item.statusCode).toBe(201);
  return { planId, workoutId, itemId: item.json().id as string };
}

describe('D-080/D-083 — criacao do plano', () => {
  it('cria plano LETTER com treinos A/B e recusa dia da semana', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'letter@fitvo.dev');

    const plan = await createPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
      title: 'Musculacao Julho',
      organization: 'LETTER',
    });
    expect(plan.statusCode).toBe(201);
    expect(plan.json().organization).toBe('LETTER');
    const planId = plan.json().id as string;

    for (const label of ['A', 'B']) {
      const workout = await createWorkout(harness.app, TENANT_A, planId, pro.token, {
        title: `Treino ${label}`,
        label,
      });
      expect(workout.statusCode).toBe(201);
      expect(workout.json().label).toBe(label);
      expect(workout.json().weekday).toBeNull();
    }

    // D-080: num plano por LETRA, marcar dia da semana deixaria o treino
    // invisivel na organizacao escolhida.
    const wrong = await createWorkout(harness.app, TENANT_A, planId, pro.token, {
      title: 'Treino de terca',
      weekday: 'TUESDAY',
    });
    expect(wrong.statusCode).toBe(422);

    await harness.app.close();
  });

  it('cria plano WEEKDAY com dia marcado e recusa label', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'weekday@fitvo.dev');

    const plan = await createPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
      title: 'Rotina semanal',
      organization: 'WEEKDAY',
    });
    expect(plan.statusCode).toBe(201);
    const planId = plan.json().id as string;

    const ok = await createWorkout(harness.app, TENANT_A, planId, pro.token, {
      title: 'Peito e triceps',
      weekday: 'MONDAY',
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().weekday).toBe('MONDAY');
    expect(ok.json().label).toBeNull();

    const wrong = await createWorkout(harness.app, TENANT_A, planId, pro.token, {
      title: 'Treino A',
      label: 'A',
    });
    expect(wrong.statusCode).toBe(422);

    await harness.app.close();
  });

  it('D-079: o vinculo aceita N planos ATIVOS simultaneos', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'multiplano@fitvo.dev');

    for (const title of ['Musculacao Julho', 'Cardio Julho']) {
      const created = await createPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
        title,
        organization: 'LETTER',
      });
      expect(created.statusCode).toBe(201);
      const released = await harness.app.inject({
        method: 'POST',
        url: `/v1/workout/${TENANT_A}/plans/${created.json().id}/release`,
        headers: { authorization: `Bearer ${pro.token}` },
        payload: {},
      });
      expect(released.statusCode).toBe(200);
      expect(released.json().status).toBe('ACTIVE');
    }

    const list = await harness.app.inject({
      method: 'GET',
      url: `/v1/workout/${TENANT_A}/bonds/${pro.bondId}/plans?status=ACTIVE`,
      headers: { authorization: `Bearer ${pro.token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().plans).toHaveLength(2);

    await harness.app.close();
  });

  it('D-083: o plano nasce com validUntil derivado de validityDays (30d padrao)', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'validade@fitvo.dev');

    const padrao = await createPlan(harness.app, TENANT_A, pro.bondId, pro.token);
    expect(padrao.statusCode).toBe(201);
    expect(padrao.json().validityDays).toBe(30);
    const validUntil = new Date(padrao.json().validUntil as string);
    const createdAt = new Date(padrao.json().createdAt as string);
    const days = Math.round((validUntil.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
    expect(days).toBe(30);

    // Configuravel: 45 dias produz 45 dias.
    const custom = await createPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
      title: 'Ciclo de 45',
      organization: 'LETTER',
      validityDays: 45,
    });
    expect(custom.json().validityDays).toBe(45);
    const customDays = Math.round(
      (new Date(custom.json().validUntil as string).getTime() -
        new Date(custom.json().createdAt as string).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    expect(customDays).toBe(45);

    await harness.app.close();
  });

  it('D-084: com releaseAt futuro, liberar leva a SCHEDULED e a validade conta do releaseAt', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'agendado@fitvo.dev');

    const releaseAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const plan = await createPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
      title: 'Bloco de setembro',
      organization: 'LETTER',
      releaseAt: releaseAt.toISOString(),
    });
    expect(plan.statusCode).toBe(201);

    const released = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout/${TENANT_A}/plans/${plan.json().id}/release`,
      headers: { authorization: `Bearer ${pro.token}` },
      payload: {},
    });
    expect(released.statusCode).toBe(200);
    expect(released.json().status).toBe('SCHEDULED');
    // O plano programado nao nasce vencido: a validade conta de quando ele vale.
    expect(new Date(released.json().validUntil as string).getTime()).toBeGreaterThan(
      releaseAt.getTime(),
    );

    await harness.app.close();
  });
});

describe('D-105 — plano FIXO', () => {
  it('plano fixo coexiste com os variaveis e NAO conta na aderencia', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'fixo@fitvo.dev');

    const variavel = await createPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
      title: 'Musculacao Julho',
      organization: 'LETTER',
    });
    expect(variavel.json().isFixed).toBe(false);
    expect(variavel.json().countsTowardAdherence).toBe(true);

    const fixo = await createPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
      title: 'Mobilidade diaria',
      organization: 'LETTER',
      isFixed: true,
    });
    expect(fixo.statusCode).toBe(201);
    expect(fixo.json().isFixed).toBe(true);
    // A regra do D-105: o alongamento nao pode inflar a aderencia de quem nao treinou.
    expect(fixo.json().countsTowardAdherence).toBe(false);
    expect(fixo.json().fixedWeekdays).toEqual([]);

    // Coexistem: os dois aparecem na lista do vinculo.
    const list = await harness.app.inject({
      method: 'GET',
      url: `/v1/workout/${TENANT_A}/bonds/${pro.bondId}/plans`,
      headers: { authorization: `Bearer ${pro.token}` },
    });
    expect(list.json().plans).toHaveLength(2);
    expect(
      list.json().plans.filter((p: { countsTowardAdherence: boolean }) => p.countsTowardAdherence),
    ).toHaveLength(1);

    await harness.app.close();
  });

  it('plano fixo com dias escolhidos guarda os dias; plano variavel recusa fixedWeekdays', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'fixodias@fitvo.dev');

    const fixo = await createPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
      title: 'Alongamento seg/qua/sex',
      organization: 'LETTER',
      isFixed: true,
      fixedWeekdays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    });
    expect(fixo.statusCode).toBe(201);
    expect(fixo.json().fixedWeekdays).toEqual(['MONDAY', 'WEDNESDAY', 'FRIDAY']);

    // Num plano variavel quem distribui os dias e o TREINO (D-080) — aceitar
    // aqui criaria duas fontes de verdade.
    const invalido = await createPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
      title: 'Variavel com dias',
      organization: 'LETTER',
      fixedWeekdays: ['MONDAY'],
    });
    expect(invalido.statusCode).toBe(400);

    await harness.app.close();
  });
});

describe('D-081 — serie-linha', () => {
  it('tres series DIFERENTES no mesmo exercicio persistem distintas', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'serielinha@fitvo.dev');
    const { planId, itemId } = await seedPlanWithItem(harness, pro);

    // O exemplo literal do D-081: serie 1 (12 reps · 20kg · 60s · normal),
    // serie 2 (10 reps · 25kg · 90s), serie 3 (falha · 25kg · 90s · drop-set).
    const res = await putSets(harness.app, TENANT_A, itemId, pro.token, [
      { reps: 12, weightGrams: 20_000, restSeconds: 60 },
      { reps: 10, weightGrams: 25_000, restSeconds: 90 },
      { repsToFailure: true, weightGrams: 25_000, restSeconds: 90, technique: 'DROP_SET' },
    ]);
    expect(res.statusCode).toBe(200);

    const sets = res.json().sets as Record<string, unknown>[];
    expect(sets).toHaveLength(3);
    expect(sets.map((s) => s.position)).toEqual([0, 1, 2]);
    expect(sets[0]).toMatchObject({ reps: 12, weightGrams: 20_000, repsToFailure: false });
    expect(sets[1]).toMatchObject({ reps: 10, weightGrams: 25_000 });
    expect(sets[2]).toMatchObject({
      reps: null,
      repsToFailure: true,
      weightGrams: 25_000,
      technique: 'DROP_SET',
    });

    // E o que foi gravado sobrevive a releitura pela arvore do plano.
    const detail = await getPlan(harness.app, TENANT_A, planId, pro.token);
    const persisted = detail.json().workouts[0].items[0].sets as Record<string, unknown>[];
    expect(persisted.map((s) => s.reps)).toEqual([12, 10, null]);
    expect(persisted.map((s) => s.weightGrams)).toEqual([20_000, 25_000, 25_000]);

    await harness.app.close();
  });

  it('carga TIPADA nao se mistura: peso, tempo e distancia ocupam colunas proprias', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'cargatipada@fitvo.dev');
    const { itemId } = await seedPlanWithItem(harness, pro);

    const res = await putSets(harness.app, TENANT_A, itemId, pro.token, [
      { reps: 10, weightGrams: 30_000 },
      { durationSeconds: 60 },
      { distanceMeters: 1_000 },
      { repsToFailure: true, bodyweight: true },
    ]);
    expect(res.statusCode).toBe(200);

    const sets = res.json().sets as Record<string, unknown>[];
    // Cada serie preenche UMA grandeza e deixa as outras nulas: uma agregacao
    // de evolucao de carga (D-092) nunca soma gramas com segundos.
    expect(sets[0]).toMatchObject({
      weightGrams: 30_000,
      durationSeconds: null,
      distanceMeters: null,
      bodyweight: false,
    });
    expect(sets[1]).toMatchObject({ weightGrams: null, durationSeconds: 60, distanceMeters: null });
    expect(sets[2]).toMatchObject({
      weightGrams: null,
      durationSeconds: null,
      distanceMeters: 1_000,
    });
    expect(sets[3]).toMatchObject({ weightGrams: null, bodyweight: true, repsToFailure: true });

    await harness.app.close();
  });

  it('serie com DUAS grandezas de carga e recusada no contrato', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'cargadupla@fitvo.dev');
    const { itemId } = await seedPlanWithItem(harness, pro);

    const res = await putSets(harness.app, TENANT_A, itemId, pro.token, [
      { reps: 10, weightGrams: 30_000, durationSeconds: 60 },
    ]);
    expect(res.statusCode).toBe(400);

    await harness.app.close();
  });

  it('serie SEM grandeza de carga nenhuma e recusada', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'semcarga@fitvo.dev');
    const { itemId } = await seedPlanWithItem(harness, pro);

    const res = await putSets(harness.app, TENANT_A, itemId, pro.token, [{ reps: 10 }]);
    expect(res.statusCode).toBe(400);

    await harness.app.close();
  });

  it('"ate a falha" nao convive com numero de repeticoes prescrito', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'falha@fitvo.dev');
    const { itemId } = await seedPlanWithItem(harness, pro);

    const res = await putSets(harness.app, TENANT_A, itemId, pro.token, [
      { reps: 10, repsToFailure: true, weightGrams: 20_000 },
    ]);
    expect(res.statusCode).toBe(400);

    await harness.app.close();
  });

  it('a substituicao troca a lista inteira — nao acumula series antigas', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'substitui@fitvo.dev');
    const { itemId } = await seedPlanWithItem(harness, pro);

    await putSets(harness.app, TENANT_A, itemId, pro.token, [
      { reps: 12, weightGrams: 20_000 },
      { reps: 12, weightGrams: 20_000 },
      { reps: 12, weightGrams: 20_000 },
    ]);
    const res = await putSets(harness.app, TENANT_A, itemId, pro.token, [
      { reps: 8, weightGrams: 30_000 },
    ]);

    expect(res.json().sets).toHaveLength(1);
    expect(res.json().sets[0]).toMatchObject({ position: 0, reps: 8, weightGrams: 30_000 });

    await harness.app.close();
  });
});

describe('D-082 — conjugados', () => {
  it('bi-set exige a MESMA contagem de series entre os itens do grupo', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'biset@fitvo.dev');
    const { workoutId } = await seedPlanWithItem(harness, pro);

    const itemA = await createItem(harness.app, TENANT_A, workoutId, pro.token, {
      position: 1,
      supersetGroup: 1,
      supersetOrder: 0,
    });
    const itemB = await createItem(harness.app, TENANT_A, workoutId, pro.token, {
      position: 2,
      supersetGroup: 1,
      supersetOrder: 1,
    });
    expect(itemA.statusCode).toBe(201);
    expect(itemB.statusCode).toBe(201);

    // 3 rodadas de A+B: cada item do grupo tem 3 series.
    const three = [
      { reps: 12, weightGrams: 20_000, restSeconds: 0 },
      { reps: 10, weightGrams: 22_000, restSeconds: 0 },
      { repsToFailure: true, weightGrams: 22_000, restSeconds: 90 },
    ];
    expect(
      (await putSets(harness.app, TENANT_A, itemA.json().id, pro.token, three)).statusCode,
    ).toBe(200);
    expect(
      (await putSets(harness.app, TENANT_A, itemB.json().id, pro.token, three)).statusCode,
    ).toBe(200);

    // Reduzir B para 2 series quebra o conjugado: a rodada 3 deixaria de existir para ele.
    const broken = await putSets(
      harness.app,
      TENANT_A,
      itemB.json().id,
      pro.token,
      three.slice(0, 2),
    );
    expect(broken.statusCode).toBe(422);

    await harness.app.close();
  });

  it('a RODADA N e a serie de ordem N — e as rodadas podem divergir entre si', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'rodada@fitvo.dev');
    const { planId, workoutId } = await seedPlanWithItem(harness, pro);

    const itemA = await createItem(harness.app, TENANT_A, workoutId, pro.token, {
      position: 1,
      supersetGroup: 2,
      supersetOrder: 0,
    });
    const itemB = await createItem(harness.app, TENANT_A, workoutId, pro.token, {
      position: 2,
      supersetGroup: 2,
      supersetOrder: 1,
    });

    // Rodada 3 mais pesada que a 1 — exatamente o que um `roundCount` impediria.
    await putSets(harness.app, TENANT_A, itemA.json().id, pro.token, [
      { reps: 12, weightGrams: 20_000, restSeconds: 0 },
      { reps: 10, weightGrams: 22_000, restSeconds: 0 },
      { reps: 8, weightGrams: 26_000, restSeconds: 0 },
    ]);
    await putSets(harness.app, TENANT_A, itemB.json().id, pro.token, [
      { reps: 15, bodyweight: true, restSeconds: 0 },
      { reps: 15, bodyweight: true, restSeconds: 0 },
      // Descanso entre rodadas vive na serie do ULTIMO item do grupo (D-082).
      { repsToFailure: true, bodyweight: true, restSeconds: 120 },
    ]);

    const detail = await getPlan(harness.app, TENANT_A, planId, pro.token);
    const group = (detail.json().workouts[0].items as Record<string, unknown>[]).filter(
      (item) => item.supersetGroup === 2,
    );
    expect(group).toHaveLength(2);
    for (const item of group) {
      expect((item.sets as unknown[]).length).toBe(3);
    }
    // Rodada 3 = serie de posicao 2 de cada item.
    const rodada3 = group.map((item) => (item.sets as Record<string, unknown>[])[2]);
    expect(rodada3[0]).toMatchObject({ position: 2, weightGrams: 26_000 });
    expect(rodada3[1]).toMatchObject({ position: 2, repsToFailure: true, restSeconds: 120 });

    await harness.app.close();
  });

  it('mover um item para um grupo com contagem diferente e recusado', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'move@fitvo.dev');
    const { workoutId, itemId } = await seedPlanWithItem(harness, pro);

    // Item solto com 2 series.
    await putSets(harness.app, TENANT_A, itemId, pro.token, [
      { reps: 10, weightGrams: 20_000 },
      { reps: 10, weightGrams: 20_000 },
    ]);
    // Grupo 5 ja com 3 series.
    const grouped = await createItem(harness.app, TENANT_A, workoutId, pro.token, {
      position: 1,
      supersetGroup: 5,
      supersetOrder: 0,
    });
    await putSets(harness.app, TENANT_A, grouped.json().id, pro.token, [
      { reps: 10, weightGrams: 20_000 },
      { reps: 10, weightGrams: 20_000 },
      { reps: 10, weightGrams: 20_000 },
    ]);

    const moved = await harness.app.inject({
      method: 'PATCH',
      url: `/v1/workout/${TENANT_A}/items/${itemId}`,
      headers: { authorization: `Bearer ${pro.token}` },
      payload: { supersetGroup: 5, supersetOrder: 1 },
    });
    expect(moved.statusCode).toBe(422);

    await harness.app.close();
  });

  it('liberar plano com conjugado INCOMPLETO e barrado', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'incompleto@fitvo.dev');
    const { planId, workoutId } = await seedPlanWithItem(harness, pro);

    const itemA = await createItem(harness.app, TENANT_A, workoutId, pro.token, {
      position: 1,
      supersetGroup: 1,
      supersetOrder: 0,
    });
    // Par do conjugado adicionado, mas sem serie nenhuma.
    await createItem(harness.app, TENANT_A, workoutId, pro.token, {
      position: 2,
      supersetGroup: 1,
      supersetOrder: 1,
    });
    await putSets(harness.app, TENANT_A, itemA.json().id, pro.token, [
      { reps: 10, weightGrams: 20_000 },
    ]);

    const released = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout/${TENANT_A}/plans/${planId}/release`,
      headers: { authorization: `Bearer ${pro.token}` },
      payload: {},
    });
    expect(released.statusCode).toBe(422);

    await harness.app.close();
  });
});

describe('D-090 — clonagem', () => {
  it('clona o plano inteiro para OUTRO vinculo e registra a linhagem', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'clona@fitvo.dev');
    const targetBondId = harness.workout.seedBond({
      tenantId: TENANT_A,
      professionalProfileId: pro.professionalProfileId,
    });

    const { planId, itemId } = await seedPlanWithItem(harness, pro);
    await putSets(harness.app, TENANT_A, itemId, pro.token, [
      { reps: 12, weightGrams: 20_000, restSeconds: 60 },
      { repsToFailure: true, weightGrams: 25_000, technique: 'DROP_SET' },
    ]);

    const clone = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout/${TENANT_A}/plans/${planId}/clone`,
      headers: { authorization: `Bearer ${pro.token}` },
      payload: { targetBondId, title: 'Copia para a Maria' },
    });
    expect(clone.statusCode).toBe(201);
    const copy = clone.json();

    expect(copy.bondId).toBe(targetBondId);
    expect(copy.id).not.toBe(planId);
    expect(copy.title).toBe('Copia para a Maria');
    expect(copy.clonedFromWorkoutPlanId).toBe(planId);
    // A copia chega como rascunho, nao liberada por acidente ao aluno de destino.
    expect(copy.status).toBe('DRAFT');

    // Copia PROFUNDA: treinos, itens e series com registros PROPRIOS.
    const detail = await getPlan(harness.app, TENANT_A, copy.id, pro.token);
    const copiedItem = detail.json().workouts[0].items[0];
    expect(detail.json().workouts).toHaveLength(1);
    expect(copiedItem.sets).toHaveLength(2);
    expect(copiedItem.id).not.toBe(itemId);
    expect(copiedItem.sets[0]).toMatchObject({ reps: 12, weightGrams: 20_000 });
    expect(copiedItem.sets[1]).toMatchObject({ repsToFailure: true, technique: 'DROP_SET' });

    // A origem permanece intacta.
    const original = await getPlan(harness.app, TENANT_A, planId, pro.token);
    expect(original.json().workouts[0].items[0].sets).toHaveLength(2);
    expect(original.json().clonedFromWorkoutPlanId).toBeNull();

    await harness.app.close();
  });

  it('nao clona para vinculo de OUTRO profissional', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'origem@fitvo.dev');
    const outro = await setupProfessional(harness, TENANT_A, 'destino@fitvo.dev');
    const { planId } = await seedPlanWithItem(harness, pro);

    const clone = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout/${TENANT_A}/plans/${planId}/clone`,
      headers: { authorization: `Bearer ${pro.token}` },
      payload: { targetBondId: outro.bondId },
    });
    // Clonar nao pode virar um caminho de escrita no vinculo de outra pessoa.
    expect(clone.statusCode).toBe(404);

    await harness.app.close();
  });
});

describe('escopo por vinculo e por tenant', () => {
  it('profissional de OUTRO vinculo nao le nem escreve o plano', async () => {
    const harness = await buildTestHarness();
    const dono = await setupProfessional(harness, TENANT_A, 'dono@fitvo.dev');
    const intruso = await setupProfessional(harness, TENANT_A, 'intruso@fitvo.dev');
    const { planId, itemId } = await seedPlanWithItem(harness, dono);

    const read = await getPlan(harness.app, TENANT_A, planId, intruso.token);
    expect(read.statusCode).toBe(404);

    const write = await putSets(harness.app, TENANT_A, itemId, intruso.token, [
      { reps: 1, weightGrams: 1_000 },
    ]);
    expect(write.statusCode).toBe(404);

    const archive = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout/${TENANT_A}/plans/${planId}/archive`,
      headers: { authorization: `Bearer ${intruso.token}` },
      payload: {},
    });
    expect(archive.statusCode).toBe(404);

    await harness.app.close();
  });

  it('profissional de OUTRO tenant recebe 403 antes de qualquer query', async () => {
    const harness = await buildTestHarness();
    const dono = await setupProfessional(harness, TENANT_A, 'tenantA@fitvo.dev');
    const outroTenant = await setupProfessional(harness, TENANT_B, 'tenantB@fitvo.dev');
    const { planId } = await seedPlanWithItem(harness, dono);

    // Path controlado pelo cliente: apontar para o tenant do dono nao basta —
    // o guard exige perfil profissional NAQUELE tenant (D-002/premissa nº1).
    const read = await getPlan(harness.app, TENANT_A, planId, outroTenant.token);
    expect(read.statusCode).toBe(403);
    expect(read.json()).not.toHaveProperty('workouts');

    // E o proprio tenant do intruso nao enxerga o plano alheio.
    const outroPath = await getPlan(harness.app, TENANT_B, planId, outroTenant.token);
    expect(outroPath.statusCode).toBe(404);

    await harness.app.close();
  });

  it('listar planos de vinculo alheio devolve 404, nunca lista vazia', async () => {
    const harness = await buildTestHarness();
    const dono = await setupProfessional(harness, TENANT_A, 'listadono@fitvo.dev');
    const intruso = await setupProfessional(harness, TENANT_A, 'listaintruso@fitvo.dev');
    await seedPlanWithItem(harness, dono);

    const list = await harness.app.inject({
      method: 'GET',
      url: `/v1/workout/${TENANT_A}/bonds/${dono.bondId}/plans`,
      headers: { authorization: `Bearer ${intruso.token}` },
    });
    // Lista vazia ensinaria que o id existe; 404 nao diz nada.
    expect(list.statusCode).toBe(404);

    await harness.app.close();
  });

  it('sem token, nenhuma rota responde', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'semtoken@fitvo.dev');

    const res = await harness.app.inject({
      method: 'GET',
      url: `/v1/workout/${TENANT_A}/bonds/${pro.bondId}/plans`,
    });
    expect(res.statusCode).toBe(401);

    await harness.app.close();
  });
});

describe('D-165 — DRAFT invisivel ao aluno', () => {
  it('o aluno so ve o plano depois de liberado', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'draft@fitvo.dev');

    // A conta de paciente so nasce pelo aceite de convite (D-135), fora do
    // escopo desta slice: o teste arranja uma conta com token valido e semeia o
    // PERFIL de paciente no repositorio de treino — mesma convencao das demais
    // slices (cada uma semeia o proprio mundo). O que esta sob teste e a
    // visibilidade do plano, nao o nascimento da conta.
    const register = await harness.app.inject({
      method: 'POST',
      url: '/v1/auth/register/professional',
      payload: { ...proPayload, email: 'aluno-draft@fitvo.dev' },
    });
    expect(register.statusCode).toBe(201);
    const alunoToken = register.json().tokens.accessToken as string;
    const patientProfileId = harness.workout.seedPatient({
      accountId: register.json().account.id,
    });
    const bondId = harness.workout.seedBond({
      tenantId: TENANT_A,
      professionalProfileId: pro.professionalProfileId,
      patientProfileId,
    });

    const plan = await createPlan(harness.app, TENANT_A, bondId, pro.token);
    expect(plan.statusCode).toBe(201);
    expect(plan.json().status).toBe('DRAFT');

    const antes = await harness.app.inject({
      method: 'GET',
      url: '/v1/workout/me/plans',
      headers: { authorization: `Bearer ${alunoToken}` },
    });
    expect(antes.statusCode).toBe(200);
    // Plano em montagem NAO existe para quem vai executar.
    expect(antes.json().plans).toHaveLength(0);

    await harness.app.inject({
      method: 'POST',
      url: `/v1/workout/${TENANT_A}/plans/${plan.json().id}/release`,
      headers: { authorization: `Bearer ${pro.token}` },
      payload: {},
    });

    const depois = await harness.app.inject({
      method: 'GET',
      url: '/v1/workout/me/plans',
      headers: { authorization: `Bearer ${alunoToken}` },
    });
    expect(depois.json().plans).toHaveLength(1);
    expect(depois.json().plans[0].status).toBe('ACTIVE');

    // E o aluno nao ve plano de OUTRO vinculo (o do setup do profissional).
    await createPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
      title: 'Plano de outro aluno',
      organization: 'LETTER',
    });
    const soDoAluno = await harness.app.inject({
      method: 'GET',
      url: '/v1/workout/me/plans',
      headers: { authorization: `Bearer ${alunoToken}` },
    });
    expect(soDoAluno.json().plans).toHaveLength(1);

    await harness.app.close();
  });
});

describe('D-053/D-089 — arquivamento e delecao logica', () => {
  it('plano ARCHIVED nao aceita mais alteracao de prescricao', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'arquiva@fitvo.dev');
    const { planId, workoutId } = await seedPlanWithItem(harness, pro);

    const archived = await harness.app.inject({
      method: 'POST',
      url: `/v1/workout/${TENANT_A}/plans/${planId}/archive`,
      headers: { authorization: `Bearer ${pro.token}` },
      payload: {},
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json().status).toBe('ARCHIVED');

    // Historico que muda nao e historico.
    const write = await createItem(harness.app, TENANT_A, workoutId, pro.token);
    expect(write.statusCode).toBe(409);

    const patch = await harness.app.inject({
      method: 'PATCH',
      url: `/v1/workout/${TENANT_A}/plans/${planId}`,
      headers: { authorization: `Bearer ${pro.token}` },
      payload: { title: 'Renomeado' },
    });
    expect(patch.statusCode).toBe(409);

    // Mas continua LEGIVEL — arquivar preserva, nao apaga.
    const read = await getPlan(harness.app, TENANT_A, planId, pro.token);
    expect(read.statusCode).toBe(200);

    await harness.app.close();
  });

  it('remover treino some da arvore e leva os itens junto', async () => {
    const harness = await buildTestHarness();
    const pro = await setupProfessional(harness, TENANT_A, 'remove@fitvo.dev');
    const { planId, workoutId, itemId } = await seedPlanWithItem(harness, pro);

    const removed = await harness.app.inject({
      method: 'DELETE',
      url: `/v1/workout/${TENANT_A}/workouts/${workoutId}`,
      headers: { authorization: `Bearer ${pro.token}` },
    });
    expect(removed.statusCode).toBe(204);

    const detail = await getPlan(harness.app, TENANT_A, planId, pro.token);
    expect(detail.json().workouts).toHaveLength(0);

    // O item orfao tambem some das leituras que entram por ele.
    const orphan = await putSets(harness.app, TENANT_A, itemId, pro.token, [
      { reps: 10, weightGrams: 20_000 },
    ]);
    expect(orphan.statusCode).toBe(404);

    await harness.app.close();
  });
});

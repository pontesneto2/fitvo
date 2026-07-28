import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';

import { buildTestHarness, type TestHarness } from '../../testing/build-test-app';
import { validProfessionalRegistration } from '../../testing/professional-registration-fixture';

const TENANT_A = 'nutri_tenant_a';
const TENANT_B = 'nutri_tenant_b';

const proPayload = {
  ...validProfessionalRegistration,
  name: 'Profissional',
  specialtyId: 'spec_nutrition',
  councilDocument: 'CRN-123456',
};

/**
 * Registra um profissional (via auth) e semeia perfil + vinculo no
 * repositorio de nutricao (in-memory, isolado do modulo patient — cada slice
 * semeia o proprio mundo). Devolve token e ids para montar as rotas do teste.
 */
async function setupBond(
  harness: TestHarness,
  tenantId: string,
  email: string,
): Promise<{ token: string; professionalProfileId: string; bondId: string }> {
  const res = await harness.app.inject({
    method: 'POST',
    url: '/v1/auth/register/professional',
    payload: { ...proPayload, email },
  });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  await harness.accounts.markEmailVerified(body.account.id);
  const professionalProfileId = harness.nutrition.seedProfessional({
    accountId: body.account.id,
    tenantId,
  });
  const bondId = harness.nutrition.seedBond({ tenantId, professionalProfileId });
  return { token: body.tokens.accessToken, professionalProfileId, bondId };
}

function createMealPlan(
  app: FastifyInstance,
  tenantId: string,
  bondId: string,
  token: string,
  body: Record<string, unknown> = { title: 'Plano de cutting' },
) {
  return app.inject({
    method: 'POST',
    url: `/v1/nutrition/${tenantId}/bonds/${bondId}/meal-plans`,
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  });
}

function getMealPlan(app: FastifyInstance, tenantId: string, mealPlanId: string, token: string) {
  return app.inject({
    method: 'GET',
    url: `/v1/nutrition/${tenantId}/meal-plans/${mealPlanId}`,
    headers: { authorization: `Bearer ${token}` },
  });
}

function createMeal(
  app: FastifyInstance,
  tenantId: string,
  mealPlanId: string,
  token: string,
  body: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: `/v1/nutrition/${tenantId}/meal-plans/${mealPlanId}/meals`,
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  });
}

function createItem(
  app: FastifyInstance,
  tenantId: string,
  mealId: string,
  token: string,
  body: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: `/v1/nutrition/${tenantId}/meals/${mealId}/items`,
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  });
}

describe('fluxo de montagem do plano alimentar (E2E via inject — ADR-0013)', () => {
  it('caminho feliz: cria plano, refeicao e item; GET devolve a arvore completa', async () => {
    const harness = await buildTestHarness();
    const pro = await setupBond(harness, TENANT_A, 'pro-a@fitvo.dev');

    const planRes = await createMealPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
      title: 'Plano de cutting',
      normalizationAnchor: 'PROTEIN',
    });
    expect(planRes.statusCode).toBe(201);
    const plan = planRes.json();
    expect(plan).toMatchObject({
      bondId: pro.bondId,
      title: 'Plano de cutting',
      normalizationAnchor: 'PROTEIN',
    });

    const mealRes = await createMeal(harness.app, TENANT_A, plan.id, pro.token, {
      moment: 'ALMOCO',
      anchorOverride: 'FAT',
    });
    expect(mealRes.statusCode).toBe(201);
    const meal = mealRes.json();
    expect(meal).toMatchObject({ mealPlanId: plan.id, moment: 'ALMOCO', anchorOverride: 'FAT' });

    const foodId = harness.nutrition.seedFood({ name: 'Frango grelhado', energyKcal: 165 });
    const itemRes = await createItem(harness.app, TENANT_A, meal.id, pro.token, {
      foodId,
      quantityGrams: 150,
    });
    expect(itemRes.statusCode).toBe(201);
    expect(itemRes.json()).toMatchObject({ mealId: meal.id, foodId, quantityGrams: 150 });

    const detail = await getMealPlan(harness.app, TENANT_A, plan.id, pro.token);
    expect(detail.statusCode).toBe(200);
    const detailBody = detail.json();
    expect(detailBody.meals).toHaveLength(1);
    expect(detailBody.meals[0].items).toHaveLength(1);
    expect(detailBody.meals[0].items[0]).toMatchObject({ foodId, quantityGrams: 150 });

    await harness.app.close();
  });

  it('o plano herda a ancora default CALORIES quando nao informada', async () => {
    const harness = await buildTestHarness();
    const pro = await setupBond(harness, TENANT_A, 'pro-default@fitvo.dev');

    const planRes = await createMealPlan(harness.app, TENANT_A, pro.bondId, pro.token, {
      title: 'Plano sem ancora explicita',
    });
    expect(planRes.statusCode).toBe(201);
    expect(planRes.json().normalizationAnchor).toBe('CALORIES');

    await harness.app.close();
  });

  it('isolamento por tenant/vinculo (D-002): um tenant nao le plano de outro', async () => {
    const harness = await buildTestHarness();
    const proA = await setupBond(harness, TENANT_A, 'pro-a2@fitvo.dev');
    const proB = await setupBond(harness, TENANT_B, 'pro-b@fitvo.dev');

    const planRes = await createMealPlan(harness.app, TENANT_A, proA.bondId, proA.token);
    expect(planRes.statusCode).toBe(201);
    const plan = planRes.json();

    // Mesmo id de plano, tenant do profissional B: nao encontra (404), nao vaza dado clinico.
    const crossTenantRead = await getMealPlan(harness.app, TENANT_B, plan.id, proB.token);
    expect(crossTenantRead.statusCode).toBe(404);

    // Profissional B tentando criar plano no vinculo do profissional A (bond de outro
    // tenant) tambem e recusado — o guard de vinculo e por tenant+dono, nao so por id.
    const crossBondWrite = await createMealPlan(harness.app, TENANT_B, proA.bondId, proB.token);
    expect(crossBondWrite.statusCode).toBe(404);

    await harness.app.close();
  });

  it('busca de montagem filtra OPEN_FOOD_FACTS fora (D-117)', async () => {
    const harness = await buildTestHarness();
    const pro = await setupBond(harness, TENANT_A, 'pro-food@fitvo.dev');
    harness.nutrition.seedFood({ name: 'Arroz branco TACO', source: 'TACO' });
    harness.nutrition.seedFood({ name: 'Arroz branco OFF', source: 'OPEN_FOOD_FACTS' });

    const res = await harness.app.inject({
      method: 'GET',
      url: `/v1/nutrition/${TENANT_A}/foods?query=arroz`,
      headers: { authorization: `Bearer ${pro.token}` },
    });
    expect(res.statusCode).toBe(200);
    const { foods } = res.json();
    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ name: 'Arroz branco TACO', source: 'TACO' });

    await harness.app.close();
  });

  it('XOR do MealPlanItem (D-114/D-115): exatamente um modo — alimento, grupo ou texto livre', async () => {
    const harness = await buildTestHarness();
    const pro = await setupBond(harness, TENANT_A, 'pro-xor@fitvo.dev');
    const plan = (await createMealPlan(harness.app, TENANT_A, pro.bondId, pro.token)).json();
    const meal = (
      await createMeal(harness.app, TENANT_A, plan.id, pro.token, { moment: 'JANTAR' })
    ).json();
    const foodId = harness.nutrition.seedFood({ name: 'Ovo' });

    // Nenhum modo.
    expect((await createItem(harness.app, TENANT_A, meal.id, pro.token, {})).statusCode).toBe(400);

    // Dois modos ao mesmo tempo (alimento + texto livre).
    expect(
      (
        await createItem(harness.app, TENANT_A, meal.id, pro.token, {
          foodId,
          quantityGrams: 50,
          freeText: 'ou cafe sem acucar',
        })
      ).statusCode,
    ).toBe(400);

    // Alimento sem a quantidade (par incompleto).
    expect(
      (await createItem(harness.app, TENANT_A, meal.id, pro.token, { foodId })).statusCode,
    ).toBe(400);

    // Os tres modos validos, isolados.
    expect(
      (await createItem(harness.app, TENANT_A, meal.id, pro.token, { foodId, quantityGrams: 50 }))
        .statusCode,
    ).toBe(201);
    const groupId = 'group_1';
    expect(
      (
        await createItem(harness.app, TENANT_A, meal.id, pro.token, {
          foodGroupId: groupId,
          portionQuantity: 1,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await createItem(harness.app, TENANT_A, meal.id, pro.token, {
          freeText: 'salada a vontade',
        })
      ).statusCode,
    ).toBe(201);

    await harness.app.close();
  });

  it('XOR rejeita modo completo com campo perdido de outro modo (regressao)', async () => {
    const harness = await buildTestHarness();
    const pro = await setupBond(harness, TENANT_A, 'pro-xor-stray@fitvo.dev');
    const plan = (await createMealPlan(harness.app, TENANT_A, pro.bondId, pro.token)).json();
    const meal = (
      await createMeal(harness.app, TENANT_A, plan.id, pro.token, { moment: 'JANTAR' })
    ).json();
    const foodId = harness.nutrition.seedFood({ name: 'Ovo' });

    // Modo ALIMENTO completo (foodId + quantityGrams) com um campo perdido do
    // modo GRUPO (foodGroupId sem portionQuantity). Um XOR ingenuo que so conta
    // "quantos modos estao completos" aceitaria isto por engano (exatamente 1
    // modo completo) — o refine tem que rejeitar por causa do campo cross-mode
    // sem par.
    const strayGroupField = await createItem(harness.app, TENANT_A, meal.id, pro.token, {
      foodId,
      quantityGrams: 50,
      foodGroupId: 'group_stray',
    });
    expect(strayGroupField.statusCode).toBe(400);

    // Caso simetrico: modo GRUPO completo (foodGroupId + portionQuantity) com
    // um campo perdido do modo ALIMENTO (foodId sem quantityGrams).
    const strayFoodField = await createItem(harness.app, TENANT_A, meal.id, pro.token, {
      foodGroupId: 'group_1',
      portionQuantity: 1,
      foodId,
    });
    expect(strayFoodField.statusCode).toBe(400);

    await harness.app.close();
  });

  it('404 ao criar plano em vinculo inexistente; 401 sem token', async () => {
    const harness = await buildTestHarness();
    const pro = await setupBond(harness, TENANT_A, 'pro-404@fitvo.dev');

    const missingBond = await createMealPlan(harness.app, TENANT_A, 'bond_inexistente', pro.token);
    expect(missingBond.statusCode).toBe(404);

    const unauthorized = await harness.app.inject({
      method: 'POST',
      url: `/v1/nutrition/${TENANT_A}/bonds/${pro.bondId}/meal-plans`,
      payload: { title: 'Sem token' },
    });
    expect(unauthorized.statusCode).toBe(401);

    await harness.app.close();
  });
});

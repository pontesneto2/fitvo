import {
  nutritionBondParamsSchema,
  nutritionCreateMealPlanItemSchema,
  nutritionCreateMealPlanSchema,
  nutritionCreateMealSchema,
  nutritionFoodSearchQuerySchema,
  nutritionFoodSearchResultSchema,
  nutritionItemParamsSchema,
  nutritionMealParamsSchema,
  nutritionMealPlanDetailViewSchema,
  nutritionMealPlanItemViewSchema,
  nutritionMealPlanListResultSchema,
  nutritionMealPlanParamsSchema,
  nutritionMealPlanSummaryViewSchema,
  nutritionMealViewSchema,
  nutritionTenantParamsSchema,
  nutritionUpdateMealPlanItemSchema,
  nutritionUpdateMealPlanSchema,
  nutritionUpdateMealSchema,
  problemDetailsSchema,
} from '@fitvo/validation';
import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { NutritionApplicationService } from './nutrition-application-service';

const TAGS = ['nutrition'];
const bearerAuth = [{ bearerAuth: [] }];

/**
 * Vertical slice de nutricao — fatia 1: montagem do plano alimentar
 * (MealPlan -> Meal -> MealPlanItem, D-112/D-114/D-115 — ADR-0013) + busca de
 * Food para montagem (D-117, exclui OPEN_FOOD_FACTS). Versao na URL /v1
 * (D-034). Todas as rotas exigem perfil profissional no tenant e, para
 * recursos abaixo do plano, que o vinculo pertenca a este profissional
 * (D-002/ADR-0001). Fora de escopo: MealLog (D-118), admin de FoodGroup.
 *
 * D-032: schemas Zod de `@fitvo/validation` sao a fonte unica.
 */
export function nutritionRoutes(service: NutritionApplicationService): FastifyPluginAsync {
  return async (fastify) => {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    const app = fastify.withTypeProvider<ZodTypeProvider>();

    app.post(
      '/:tenantId/bonds/:bondId/meal-plans',
      {
        schema: {
          tags: TAGS,
          summary: 'Cria um plano alimentar para o vinculo (profissional)',
          security: bearerAuth,
          params: nutritionBondParamsSchema,
          body: nutritionCreateMealPlanSchema,
          response: { 201: nutritionMealPlanSummaryViewSchema, 404: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        const plan = await service.createMealPlan(
          request.headers.authorization,
          request.params.tenantId,
          request.params.bondId,
          request.body,
        );
        return reply.code(201).send(plan);
      },
    );

    app.get(
      '/:tenantId/bonds/:bondId/meal-plans',
      {
        schema: {
          tags: TAGS,
          summary: 'Lista os planos alimentares do vinculo (profissional)',
          security: bearerAuth,
          params: nutritionBondParamsSchema,
          response: { 200: nutritionMealPlanListResultSchema },
        },
      },
      async (request, reply) => {
        const mealPlans = await service.listMealPlans(
          request.headers.authorization,
          request.params.tenantId,
          request.params.bondId,
        );
        return reply.send({ mealPlans });
      },
    );

    app.get(
      '/:tenantId/meal-plans/:mealPlanId',
      {
        schema: {
          tags: TAGS,
          summary: 'Detalha um plano alimentar (refeicoes + itens)',
          security: bearerAuth,
          params: nutritionMealPlanParamsSchema,
          response: { 200: nutritionMealPlanDetailViewSchema, 404: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        return reply.send(
          await service.getMealPlan(
            request.headers.authorization,
            request.params.tenantId,
            request.params.mealPlanId,
          ),
        );
      },
    );

    app.patch(
      '/:tenantId/meal-plans/:mealPlanId',
      {
        schema: {
          tags: TAGS,
          summary: 'Atualiza titulo/ancora de normalizacao do plano alimentar',
          security: bearerAuth,
          params: nutritionMealPlanParamsSchema,
          body: nutritionUpdateMealPlanSchema,
          response: { 200: nutritionMealPlanSummaryViewSchema, 404: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        return reply.send(
          await service.updateMealPlan(
            request.headers.authorization,
            request.params.tenantId,
            request.params.mealPlanId,
            request.body,
          ),
        );
      },
    );

    app.delete(
      '/:tenantId/meal-plans/:mealPlanId',
      {
        schema: {
          tags: TAGS,
          summary: 'Remove um plano alimentar',
          security: bearerAuth,
          params: nutritionMealPlanParamsSchema,
        },
      },
      async (request, reply) => {
        await service.deleteMealPlan(
          request.headers.authorization,
          request.params.tenantId,
          request.params.mealPlanId,
        );
        return reply.code(204).send();
      },
    );

    app.post(
      '/:tenantId/meal-plans/:mealPlanId/meals',
      {
        schema: {
          tags: TAGS,
          summary: 'Adiciona uma refeicao ao plano (D-112/D-113)',
          security: bearerAuth,
          params: nutritionMealPlanParamsSchema,
          body: nutritionCreateMealSchema,
          response: { 201: nutritionMealViewSchema, 404: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        const meal = await service.createMeal(
          request.headers.authorization,
          request.params.tenantId,
          request.params.mealPlanId,
          request.body,
        );
        return reply.code(201).send(meal);
      },
    );

    app.patch(
      '/:tenantId/meals/:mealId',
      {
        schema: {
          tags: TAGS,
          summary: 'Atualiza uma refeicao',
          security: bearerAuth,
          params: nutritionMealParamsSchema,
          body: nutritionUpdateMealSchema,
          response: { 200: nutritionMealViewSchema, 404: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        return reply.send(
          await service.updateMeal(
            request.headers.authorization,
            request.params.tenantId,
            request.params.mealId,
            request.body,
          ),
        );
      },
    );

    app.delete(
      '/:tenantId/meals/:mealId',
      {
        schema: {
          tags: TAGS,
          summary: 'Remove uma refeicao (e seus itens)',
          security: bearerAuth,
          params: nutritionMealParamsSchema,
        },
      },
      async (request, reply) => {
        await service.deleteMeal(
          request.headers.authorization,
          request.params.tenantId,
          request.params.mealId,
        );
        return reply.code(204).send();
      },
    );

    app.post(
      '/:tenantId/meals/:mealId/items',
      {
        schema: {
          tags: TAGS,
          summary: 'Adiciona um item a refeicao (alimento, grupo ou texto livre — D-114/D-115)',
          security: bearerAuth,
          params: nutritionMealParamsSchema,
          body: nutritionCreateMealPlanItemSchema,
          response: { 201: nutritionMealPlanItemViewSchema, 404: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        const item = await service.createMealPlanItem(
          request.headers.authorization,
          request.params.tenantId,
          request.params.mealId,
          request.body,
        );
        return reply.code(201).send(item);
      },
    );

    app.patch(
      '/:tenantId/items/:itemId',
      {
        schema: {
          tags: TAGS,
          summary: 'Atualiza um item da refeicao (substitui o modo — D-114/D-115)',
          security: bearerAuth,
          params: nutritionItemParamsSchema,
          body: nutritionUpdateMealPlanItemSchema,
          response: { 200: nutritionMealPlanItemViewSchema, 404: problemDetailsSchema },
        },
      },
      async (request, reply) => {
        return reply.send(
          await service.updateMealPlanItem(
            request.headers.authorization,
            request.params.tenantId,
            request.params.itemId,
            request.body,
          ),
        );
      },
    );

    app.delete(
      '/:tenantId/items/:itemId',
      {
        schema: {
          tags: TAGS,
          summary: 'Remove um item da refeicao',
          security: bearerAuth,
          params: nutritionItemParamsSchema,
        },
      },
      async (request, reply) => {
        await service.deleteMealPlanItem(
          request.headers.authorization,
          request.params.tenantId,
          request.params.itemId,
        );
        return reply.code(204).send();
      },
    );

    app.get(
      '/:tenantId/foods',
      {
        schema: {
          tags: TAGS,
          summary: 'Busca alimentos para montagem do plano (exclui Open Food Facts — D-117)',
          security: bearerAuth,
          params: nutritionTenantParamsSchema,
          querystring: nutritionFoodSearchQuerySchema,
          response: { 200: nutritionFoodSearchResultSchema },
        },
      },
      async (request, reply) => {
        const foods = await service.searchFoods(
          request.headers.authorization,
          request.params.tenantId,
          request.query.query,
        );
        return reply.send({ foods });
      },
    );
  };
}

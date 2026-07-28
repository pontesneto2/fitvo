import type {
  NutritionCreateMealInput,
  NutritionCreateMealPlanInput,
  NutritionCreateMealPlanItemInput,
  NutritionFoodView,
  NutritionMealDetailView,
  NutritionMealPlanDetailView,
  NutritionMealPlanSummaryView,
  NutritionMealView,
  NutritionUpdateMealInput,
  NutritionUpdateMealPlanInput,
  NutritionUpdateMealPlanItemInput,
} from '@fitvo/validation';

import type { AccessTokenVerifier } from '../../shared/auth-context';
import { requireAuth } from '../../shared/auth-context';
import { ForbiddenError, NotFoundError } from '../../shared/http-errors';
import type {
  FoodRecord,
  MealDetailRecord,
  MealPlanDetailRecord,
  MealPlanItemRecord,
  MealPlanRecord,
  MealRecord,
  NutritionRepository,
} from './nutrition-repository';

function toMealPlanView(plan: MealPlanRecord): NutritionMealPlanSummaryView {
  return {
    id: plan.id,
    bondId: plan.bondId,
    title: plan.title,
    normalizationAnchor: plan.normalizationAnchor,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function toItemView(item: MealPlanItemRecord): NutritionMealDetailView['items'][number] {
  return {
    id: item.id,
    mealId: item.mealId,
    foodId: item.foodId,
    foodGroupId: item.foodGroupId,
    freeText: item.freeText,
    quantityGrams: item.quantityGrams,
    portionQuantity: item.portionQuantity,
    position: item.position,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toMealView(meal: MealRecord): NutritionMealView {
  return {
    id: meal.id,
    mealPlanId: meal.mealPlanId,
    moment: meal.moment,
    freeText: meal.freeText,
    anchorOverride: meal.anchorOverride,
    position: meal.position,
    createdAt: meal.createdAt.toISOString(),
    updatedAt: meal.updatedAt.toISOString(),
  };
}

function toMealDetailView(meal: MealDetailRecord): NutritionMealDetailView {
  return { ...toMealView(meal), items: meal.items.map(toItemView) };
}

function toMealPlanDetailView(plan: MealPlanDetailRecord): NutritionMealPlanDetailView {
  return { ...toMealPlanView(plan), meals: plan.meals.map(toMealDetailView) };
}

function toFoodView(food: FoodRecord): NutritionFoodView {
  return {
    id: food.id,
    name: food.name,
    source: food.source,
    referencePortionGrams: food.referencePortionGrams,
    energyKcal: food.energyKcal,
    proteinMg: food.proteinMg,
    carbMg: food.carbMg,
    fatMg: food.fatMg,
  };
}

/**
 * Servico de aplicacao da slice de nutricao — fatia 1 (montagem do plano
 * alimentar: MealPlan -> Meal -> MealPlanItem, D-112/D-114/D-115 — ADR-0013).
 * O plano e do VINCULO (D-002/ADR-0001): todo guard exige perfil profissional
 * no tenant E que o vinculo/recurso pertenca a ele — nunca so o id do recurso.
 * Fora de escopo desta fatia: MealLog (D-118), admin de FoodGroup, D-133/D-134.
 */
export class NutritionApplicationService {
  constructor(
    private readonly nutrition: NutritionRepository,
    private readonly tokenVerifier: AccessTokenVerifier,
  ) {}

  async createMealPlan(
    authorization: string | undefined,
    tenantId: string,
    bondId: string,
    input: NutritionCreateMealPlanInput,
  ): Promise<NutritionMealPlanSummaryView> {
    await this.requireBond(authorization, tenantId, bondId);
    const plan = await this.nutrition.createMealPlan({
      tenantId,
      bondId,
      title: input.title,
      normalizationAnchor: input.normalizationAnchor,
    });
    return toMealPlanView(plan);
  }

  async listMealPlans(
    authorization: string | undefined,
    tenantId: string,
    bondId: string,
  ): Promise<NutritionMealPlanSummaryView[]> {
    await this.requireBond(authorization, tenantId, bondId);
    const plans = await this.nutrition.listMealPlans(tenantId, bondId);
    return plans.map(toMealPlanView);
  }

  async getMealPlan(
    authorization: string | undefined,
    tenantId: string,
    mealPlanId: string,
  ): Promise<NutritionMealPlanDetailView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const plan = await this.nutrition.findMealPlanDetail(
      tenantId,
      professionalProfileId,
      mealPlanId,
    );
    if (!plan) {
      throw new NotFoundError('Plano alimentar nao encontrado.');
    }
    return toMealPlanDetailView(plan);
  }

  async updateMealPlan(
    authorization: string | undefined,
    tenantId: string,
    mealPlanId: string,
    input: NutritionUpdateMealPlanInput,
  ): Promise<NutritionMealPlanSummaryView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const plan = await this.nutrition.updateMealPlan(
      tenantId,
      professionalProfileId,
      mealPlanId,
      input,
    );
    if (!plan) {
      throw new NotFoundError('Plano alimentar nao encontrado.');
    }
    return toMealPlanView(plan);
  }

  async deleteMealPlan(
    authorization: string | undefined,
    tenantId: string,
    mealPlanId: string,
  ): Promise<void> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const deleted = await this.nutrition.deleteMealPlan(
      tenantId,
      professionalProfileId,
      mealPlanId,
    );
    if (!deleted) {
      throw new NotFoundError('Plano alimentar nao encontrado.');
    }
  }

  async createMeal(
    authorization: string | undefined,
    tenantId: string,
    mealPlanId: string,
    input: NutritionCreateMealInput,
  ): Promise<NutritionMealView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const meal = await this.nutrition.createMeal(
      tenantId,
      professionalProfileId,
      mealPlanId,
      input,
    );
    if (!meal) {
      throw new NotFoundError('Plano alimentar nao encontrado.');
    }
    return toMealView(meal);
  }

  async updateMeal(
    authorization: string | undefined,
    tenantId: string,
    mealId: string,
    input: NutritionUpdateMealInput,
  ): Promise<NutritionMealView> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const meal = await this.nutrition.updateMeal(tenantId, professionalProfileId, mealId, input);
    if (!meal) {
      throw new NotFoundError('Refeicao nao encontrada.');
    }
    return toMealView(meal);
  }

  async deleteMeal(
    authorization: string | undefined,
    tenantId: string,
    mealId: string,
  ): Promise<void> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const deleted = await this.nutrition.deleteMeal(tenantId, professionalProfileId, mealId);
    if (!deleted) {
      throw new NotFoundError('Refeicao nao encontrada.');
    }
  }

  async createMealPlanItem(
    authorization: string | undefined,
    tenantId: string,
    mealId: string,
    input: NutritionCreateMealPlanItemInput,
  ): Promise<NutritionMealDetailView['items'][number]> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const item = await this.nutrition.createMealPlanItem(
      tenantId,
      professionalProfileId,
      mealId,
      input,
    );
    if (!item) {
      throw new NotFoundError('Refeicao nao encontrada.');
    }
    return toItemView(item);
  }

  async updateMealPlanItem(
    authorization: string | undefined,
    tenantId: string,
    itemId: string,
    input: NutritionUpdateMealPlanItemInput,
  ): Promise<NutritionMealDetailView['items'][number]> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const item = await this.nutrition.updateMealPlanItem(
      tenantId,
      professionalProfileId,
      itemId,
      input,
    );
    if (!item) {
      throw new NotFoundError('Item nao encontrado.');
    }
    return toItemView(item);
  }

  async deleteMealPlanItem(
    authorization: string | undefined,
    tenantId: string,
    itemId: string,
  ): Promise<void> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const deleted = await this.nutrition.deleteMealPlanItem(
      tenantId,
      professionalProfileId,
      itemId,
    );
    if (!deleted) {
      throw new NotFoundError('Item nao encontrado.');
    }
  }

  async searchFoods(
    authorization: string | undefined,
    tenantId: string,
    query: string,
  ): Promise<NutritionFoodView[]> {
    const { professionalProfileId } = await this.requireProfessional(authorization, tenantId);
    const foods = await this.nutrition.searchFoods(professionalProfileId, query);
    return foods.map(toFoodView);
  }

  /** Guard base: Bearer valido + perfil profissional NESTE tenant (D-002). */
  private async requireProfessional(
    authorization: string | undefined,
    tenantId: string,
  ): Promise<{ professionalProfileId: string }> {
    const ctx = await requireAuth(this.tokenVerifier, authorization);
    const professional = await this.nutrition.findProfessional(ctx.accountId, tenantId);
    if (!professional) {
      throw new ForbiddenError('Requer um perfil profissional neste tenant.');
    }
    return professional;
  }

  /** Guard do vinculo: alem de profissional do tenant, deve ser o dono do bond. */
  private async requireBond(
    authorization: string | undefined,
    tenantId: string,
    bondId: string,
  ): Promise<{ professionalProfileId: string }> {
    const professional = await this.requireProfessional(authorization, tenantId);
    const bond = await this.nutrition.findBond(
      tenantId,
      professional.professionalProfileId,
      bondId,
    );
    if (!bond) {
      throw new NotFoundError('Vinculo nao encontrado.');
    }
    return professional;
  }
}

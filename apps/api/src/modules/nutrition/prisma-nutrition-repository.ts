import type { PrismaClient } from '@fitvo/database';
import { prisma as defaultPrisma } from '@fitvo/database';

import type {
  CreateMealInput,
  CreateMealPlanInput,
  CreateMealPlanItemInput,
  FoodRecord,
  MealPlanDetailRecord,
  MealPlanItemRecord,
  MealPlanRecord,
  MealRecord,
  NutritionRepository,
  UpdateMealPatch,
  UpdateMealPlanItemPatch,
  UpdateMealPlanPatch,
} from './nutrition-repository';

const MEAL_PLAN_PROJECTION = {
  id: true,
  bondId: true,
  title: true,
  normalizationAnchor: true,
  createdAt: true,
  updatedAt: true,
} as const;

const MEAL_PROJECTION = {
  id: true,
  mealPlanId: true,
  moment: true,
  freeText: true,
  anchorOverride: true,
  position: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ITEM_PROJECTION = {
  id: true,
  mealId: true,
  foodId: true,
  foodGroupId: true,
  freeText: true,
  quantityGrams: true,
  portionQuantity: true,
  position: true,
  createdAt: true,
  updatedAt: true,
} as const;

const FOOD_PROJECTION = {
  id: true,
  name: true,
  source: true,
  referencePortionGrams: true,
  energyKcal: true,
  proteinMg: true,
  carbMg: true,
  fatMg: true,
} as const;

/** Implementacao Prisma (infra) do repositorio de nutricao — fatia 1 (montagem). */
export class PrismaNutritionRepository implements NutritionRepository {
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

  async findBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
  ): Promise<{ id: string } | null> {
    const bond = await this.db.bond.findFirst({
      where: { id: bondId, tenantId, professionalProfileId },
      select: { id: true },
    });
    return bond;
  }

  createMealPlan(input: CreateMealPlanInput): Promise<MealPlanRecord> {
    return this.db.mealPlan.create({
      data: {
        tenantId: input.tenantId,
        bondId: input.bondId,
        title: input.title,
        ...(input.normalizationAnchor !== undefined
          ? { normalizationAnchor: input.normalizationAnchor }
          : {}),
      },
      select: MEAL_PLAN_PROJECTION,
    });
  }

  listMealPlans(tenantId: string, bondId: string): Promise<MealPlanRecord[]> {
    return this.db.mealPlan.findMany({
      where: { tenantId, bondId },
      select: MEAL_PLAN_PROJECTION,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMealPlanDetail(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
  ): Promise<MealPlanDetailRecord | null> {
    const plan = await this.db.mealPlan.findFirst({
      where: { id: mealPlanId, tenantId, bond: { professionalProfileId } },
      select: {
        ...MEAL_PLAN_PROJECTION,
        meals: {
          select: {
            ...MEAL_PROJECTION,
            items: { select: ITEM_PROJECTION, orderBy: { position: 'asc' } },
          },
          orderBy: { position: 'asc' },
        },
      },
    });
    return plan;
  }

  async updateMealPlan(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
    patch: UpdateMealPlanPatch,
  ): Promise<MealPlanRecord | null> {
    const result = await this.db.mealPlan.updateMany({
      where: { id: mealPlanId, tenantId, bond: { professionalProfileId } },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.normalizationAnchor !== undefined
          ? { normalizationAnchor: patch.normalizationAnchor }
          : {}),
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.db.mealPlan.findUnique({ where: { id: mealPlanId }, select: MEAL_PLAN_PROJECTION });
  }

  async deleteMealPlan(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
  ): Promise<boolean> {
    const result = await this.db.mealPlan.deleteMany({
      where: { id: mealPlanId, tenantId, bond: { professionalProfileId } },
    });
    return result.count > 0;
  }

  async createMeal(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
    input: CreateMealInput,
  ): Promise<MealRecord | null> {
    const plan = await this.db.mealPlan.findFirst({
      where: { id: mealPlanId, tenantId, bond: { professionalProfileId } },
      select: { id: true },
    });
    if (!plan) {
      return null;
    }
    return this.db.meal.create({
      data: {
        mealPlanId,
        moment: input.moment,
        freeText: input.freeText ?? null,
        anchorOverride: input.anchorOverride ?? null,
        position: input.position ?? 0,
      },
      select: MEAL_PROJECTION,
    });
  }

  async updateMeal(
    tenantId: string,
    professionalProfileId: string,
    mealId: string,
    patch: UpdateMealPatch,
  ): Promise<MealRecord | null> {
    const result = await this.db.meal.updateMany({
      where: { id: mealId, mealPlan: { tenantId, bond: { professionalProfileId } } },
      data: {
        ...(patch.moment !== undefined ? { moment: patch.moment } : {}),
        ...(patch.freeText !== undefined ? { freeText: patch.freeText } : {}),
        ...(patch.anchorOverride !== undefined ? { anchorOverride: patch.anchorOverride } : {}),
        ...(patch.position !== undefined ? { position: patch.position } : {}),
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.db.meal.findUnique({ where: { id: mealId }, select: MEAL_PROJECTION });
  }

  async deleteMeal(
    tenantId: string,
    professionalProfileId: string,
    mealId: string,
  ): Promise<boolean> {
    const result = await this.db.meal.deleteMany({
      where: { id: mealId, mealPlan: { tenantId, bond: { professionalProfileId } } },
    });
    return result.count > 0;
  }

  async createMealPlanItem(
    tenantId: string,
    professionalProfileId: string,
    mealId: string,
    input: CreateMealPlanItemInput,
  ): Promise<MealPlanItemRecord | null> {
    const meal = await this.db.meal.findFirst({
      where: { id: mealId, mealPlan: { tenantId, bond: { professionalProfileId } } },
      select: { id: true },
    });
    if (!meal) {
      return null;
    }
    return this.db.mealPlanItem.create({
      data: {
        mealId,
        foodId: input.foodId ?? null,
        quantityGrams: input.quantityGrams ?? null,
        foodGroupId: input.foodGroupId ?? null,
        portionQuantity: input.portionQuantity ?? null,
        freeText: input.freeText ?? null,
        position: input.position ?? 0,
      },
      select: ITEM_PROJECTION,
    });
  }

  async updateMealPlanItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
    patch: UpdateMealPlanItemPatch,
  ): Promise<MealPlanItemRecord | null> {
    const result = await this.db.mealPlanItem.updateMany({
      where: { id: itemId, meal: { mealPlan: { tenantId, bond: { professionalProfileId } } } },
      data: {
        foodId: patch.foodId ?? null,
        quantityGrams: patch.quantityGrams ?? null,
        foodGroupId: patch.foodGroupId ?? null,
        portionQuantity: patch.portionQuantity ?? null,
        freeText: patch.freeText ?? null,
        ...(patch.position !== undefined ? { position: patch.position } : {}),
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.db.mealPlanItem.findUnique({ where: { id: itemId }, select: ITEM_PROJECTION });
  }

  async deleteMealPlanItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
  ): Promise<boolean> {
    const result = await this.db.mealPlanItem.deleteMany({
      where: { id: itemId, meal: { mealPlan: { tenantId, bond: { professionalProfileId } } } },
    });
    return result.count > 0;
  }

  searchFoods(professionalProfileId: string, query: string): Promise<FoodRecord[]> {
    return this.db.food.findMany({
      where: {
        status: 'ACTIVE',
        source: { not: 'OPEN_FOOD_FACTS' }, // filtro OFF fora da montagem (D-117)
        name: { contains: query, mode: 'insensitive' },
        OR: [{ visibility: 'PLATFORM' }, { ownerProfessionalProfileId: professionalProfileId }],
      },
      select: FOOD_PROJECTION,
      orderBy: { name: 'asc' },
      take: 20,
    });
  }
}

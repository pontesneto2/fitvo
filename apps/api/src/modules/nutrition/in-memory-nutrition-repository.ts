import type { FoodSource, MealMoment, NormalizationAnchor } from '@fitvo/database';

import type {
  CreateMealInput,
  CreateMealPlanInput,
  CreateMealPlanItemInput,
  FoodRecord,
  MealDetailRecord,
  MealPlanDetailRecord,
  MealPlanItemRecord,
  MealPlanRecord,
  MealRecord,
  NutritionRepository,
  UpdateMealPatch,
  UpdateMealPlanItemPatch,
  UpdateMealPlanPatch,
} from './nutrition-repository';

interface StoredBond {
  id: string;
  tenantId: string;
  professionalProfileId: string;
}

interface StoredProfessional {
  id: string;
  accountId: string;
  tenantId: string;
}

interface StoredMealPlan {
  id: string;
  tenantId: string;
  bondId: string;
  title: string;
  normalizationAnchor: NormalizationAnchor;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredMeal {
  id: string;
  mealPlanId: string;
  moment: MealMoment;
  freeText: string | null;
  anchorOverride: NormalizationAnchor | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredItem {
  id: string;
  mealId: string;
  foodId: string | null;
  foodGroupId: string | null;
  freeText: string | null;
  quantityGrams: number | null;
  portionQuantity: number | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredFood {
  id: string;
  name: string;
  source: FoodSource;
  referencePortionGrams: number;
  energyKcal: number | null;
  proteinMg: number | null;
  carbMg: number | null;
  fatMg: number | null;
  visibility: 'PLATFORM' | 'PRIVATE';
  status: 'ACTIVE' | 'DISCONTINUED';
  ownerProfessionalProfileId: string | null;
}

export interface SeedFoodInput {
  name: string;
  source?: FoodSource;
  referencePortionGrams?: number;
  energyKcal?: number | null;
  proteinMg?: number | null;
  carbMg?: number | null;
  fatMg?: number | null;
  visibility?: 'PLATFORM' | 'PRIVATE';
  status?: 'ACTIVE' | 'DISCONTINUED';
  ownerProfessionalProfileId?: string | null;
}

/**
 * Implementacao em memoria para testes/dev — espelha a logica da Prisma sobre
 * Maps. Helpers `seed*` arranjam o mundo (profissional/vinculo/alimento); o
 * onboarding real vem de outras slices.
 */
export class InMemoryNutritionRepository implements NutritionRepository {
  private readonly professionals = new Map<string, StoredProfessional>();
  private readonly bonds = new Map<string, StoredBond>();
  private readonly mealPlans = new Map<string, StoredMealPlan>();
  private readonly meals = new Map<string, StoredMeal>();
  private readonly items = new Map<string, StoredItem>();
  private readonly foods = new Map<string, StoredFood>();
  private sequence = 0;

  // --- Seed helpers ---

  seedProfessional(input: { accountId: string; tenantId: string }): string {
    const id = this.nextId('pp');
    this.professionals.set(id, { id, accountId: input.accountId, tenantId: input.tenantId });
    return id;
  }

  seedBond(input: { tenantId: string; professionalProfileId: string }): string {
    const id = this.nextId('bond');
    this.bonds.set(id, {
      id,
      tenantId: input.tenantId,
      professionalProfileId: input.professionalProfileId,
    });
    return id;
  }

  seedFood(input: SeedFoodInput): string {
    const id = this.nextId('food');
    this.foods.set(id, {
      id,
      name: input.name,
      source: input.source ?? 'TACO',
      referencePortionGrams: input.referencePortionGrams ?? 100,
      energyKcal: input.energyKcal ?? null,
      proteinMg: input.proteinMg ?? null,
      carbMg: input.carbMg ?? null,
      fatMg: input.fatMg ?? null,
      visibility: input.visibility ?? 'PLATFORM',
      status: input.status ?? 'ACTIVE',
      ownerProfessionalProfileId: input.ownerProfessionalProfileId ?? null,
    });
    return id;
  }

  // --- NutritionRepository ---

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

  findBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
  ): Promise<{ id: string } | null> {
    const bond = this.bonds.get(bondId);
    if (
      !bond ||
      bond.tenantId !== tenantId ||
      bond.professionalProfileId !== professionalProfileId
    ) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ id: bond.id });
  }

  createMealPlan(input: CreateMealPlanInput): Promise<MealPlanRecord> {
    const now = new Date();
    const plan: StoredMealPlan = {
      id: this.nextId('mp'),
      tenantId: input.tenantId,
      bondId: input.bondId,
      title: input.title,
      normalizationAnchor: input.normalizationAnchor ?? 'CALORIES',
      createdAt: now,
      updatedAt: now,
    };
    this.mealPlans.set(plan.id, plan);
    return Promise.resolve(this.toMealPlanRecord(plan));
  }

  listMealPlans(tenantId: string, bondId: string): Promise<MealPlanRecord[]> {
    const rows = [...this.mealPlans.values()]
      .filter((plan) => plan.tenantId === tenantId && plan.bondId === bondId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((plan) => this.toMealPlanRecord(plan));
    return Promise.resolve(rows);
  }

  findMealPlanDetail(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
  ): Promise<MealPlanDetailRecord | null> {
    const plan = this.findOwnedMealPlan(tenantId, professionalProfileId, mealPlanId);
    if (!plan) {
      return Promise.resolve(null);
    }
    const meals = [...this.meals.values()]
      .filter((meal) => meal.mealPlanId === plan.id)
      .sort((a, b) => a.position - b.position)
      .map((meal) => this.toMealDetailRecord(meal));
    return Promise.resolve({ ...this.toMealPlanRecord(plan), meals });
  }

  updateMealPlan(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
    patch: UpdateMealPlanPatch,
  ): Promise<MealPlanRecord | null> {
    const plan = this.findOwnedMealPlan(tenantId, professionalProfileId, mealPlanId);
    if (!plan) {
      return Promise.resolve(null);
    }
    if (patch.title !== undefined) {
      plan.title = patch.title;
    }
    if (patch.normalizationAnchor !== undefined) {
      plan.normalizationAnchor = patch.normalizationAnchor;
    }
    plan.updatedAt = new Date();
    return Promise.resolve(this.toMealPlanRecord(plan));
  }

  deleteMealPlan(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
  ): Promise<boolean> {
    const plan = this.findOwnedMealPlan(tenantId, professionalProfileId, mealPlanId);
    if (!plan) {
      return Promise.resolve(false);
    }
    for (const meal of [...this.meals.values()]) {
      if (meal.mealPlanId === plan.id) {
        this.deleteMealCascade(meal.id);
      }
    }
    this.mealPlans.delete(plan.id);
    return Promise.resolve(true);
  }

  createMeal(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
    input: CreateMealInput,
  ): Promise<MealRecord | null> {
    const plan = this.findOwnedMealPlan(tenantId, professionalProfileId, mealPlanId);
    if (!plan) {
      return Promise.resolve(null);
    }
    const now = new Date();
    const meal: StoredMeal = {
      id: this.nextId('meal'),
      mealPlanId: plan.id,
      moment: input.moment,
      freeText: input.freeText ?? null,
      anchorOverride: input.anchorOverride ?? null,
      position: input.position ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.meals.set(meal.id, meal);
    return Promise.resolve(this.toMealRecord(meal));
  }

  updateMeal(
    tenantId: string,
    professionalProfileId: string,
    mealId: string,
    patch: UpdateMealPatch,
  ): Promise<MealRecord | null> {
    const meal = this.findOwnedMeal(tenantId, professionalProfileId, mealId);
    if (!meal) {
      return Promise.resolve(null);
    }
    if (patch.moment !== undefined) {
      meal.moment = patch.moment;
    }
    if (patch.freeText !== undefined) {
      meal.freeText = patch.freeText;
    }
    if (patch.anchorOverride !== undefined) {
      meal.anchorOverride = patch.anchorOverride;
    }
    if (patch.position !== undefined) {
      meal.position = patch.position;
    }
    meal.updatedAt = new Date();
    return Promise.resolve(this.toMealRecord(meal));
  }

  deleteMeal(tenantId: string, professionalProfileId: string, mealId: string): Promise<boolean> {
    const meal = this.findOwnedMeal(tenantId, professionalProfileId, mealId);
    if (!meal) {
      return Promise.resolve(false);
    }
    this.deleteMealCascade(meal.id);
    return Promise.resolve(true);
  }

  createMealPlanItem(
    tenantId: string,
    professionalProfileId: string,
    mealId: string,
    input: CreateMealPlanItemInput,
  ): Promise<MealPlanItemRecord | null> {
    const meal = this.findOwnedMeal(tenantId, professionalProfileId, mealId);
    if (!meal) {
      return Promise.resolve(null);
    }
    const now = new Date();
    const item: StoredItem = {
      id: this.nextId('item'),
      mealId: meal.id,
      foodId: input.foodId ?? null,
      foodGroupId: input.foodGroupId ?? null,
      freeText: input.freeText ?? null,
      quantityGrams: input.quantityGrams ?? null,
      portionQuantity: input.portionQuantity ?? null,
      position: input.position ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(item.id, item);
    return Promise.resolve(this.toItemRecord(item));
  }

  updateMealPlanItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
    patch: UpdateMealPlanItemPatch,
  ): Promise<MealPlanItemRecord | null> {
    const item = this.findOwnedItem(tenantId, professionalProfileId, itemId);
    if (!item) {
      return Promise.resolve(null);
    }
    item.foodId = patch.foodId ?? null;
    item.foodGroupId = patch.foodGroupId ?? null;
    item.freeText = patch.freeText ?? null;
    item.quantityGrams = patch.quantityGrams ?? null;
    item.portionQuantity = patch.portionQuantity ?? null;
    if (patch.position !== undefined) {
      item.position = patch.position;
    }
    item.updatedAt = new Date();
    return Promise.resolve(this.toItemRecord(item));
  }

  deleteMealPlanItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
  ): Promise<boolean> {
    const item = this.findOwnedItem(tenantId, professionalProfileId, itemId);
    if (!item) {
      return Promise.resolve(false);
    }
    this.items.delete(item.id);
    return Promise.resolve(true);
  }

  searchFoods(professionalProfileId: string, query: string): Promise<FoodRecord[]> {
    const needle = query.toLowerCase();
    const rows = [...this.foods.values()]
      .filter(
        (food) =>
          food.status === 'ACTIVE' &&
          food.source !== 'OPEN_FOOD_FACTS' && // filtro OFF fora da montagem (D-117)
          food.name.toLowerCase().includes(needle) &&
          (food.visibility === 'PLATFORM' ||
            food.ownerProfessionalProfileId === professionalProfileId),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20)
      .map((food) => this.toFoodRecord(food));
    return Promise.resolve(rows);
  }

  // --- helpers privados ---

  private findOwnedMealPlan(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
  ): StoredMealPlan | undefined {
    const plan = this.mealPlans.get(mealPlanId);
    if (!plan || plan.tenantId !== tenantId) {
      return undefined;
    }
    const bond = this.bonds.get(plan.bondId);
    if (!bond || bond.professionalProfileId !== professionalProfileId) {
      return undefined;
    }
    return plan;
  }

  private findOwnedMeal(
    tenantId: string,
    professionalProfileId: string,
    mealId: string,
  ): StoredMeal | undefined {
    const meal = this.meals.get(mealId);
    if (!meal) {
      return undefined;
    }
    const plan = this.findOwnedMealPlan(tenantId, professionalProfileId, meal.mealPlanId);
    return plan ? meal : undefined;
  }

  private findOwnedItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
  ): StoredItem | undefined {
    const item = this.items.get(itemId);
    if (!item) {
      return undefined;
    }
    const meal = this.findOwnedMeal(tenantId, professionalProfileId, item.mealId);
    return meal ? item : undefined;
  }

  private deleteMealCascade(mealId: string): void {
    for (const item of [...this.items.values()]) {
      if (item.mealId === mealId) {
        this.items.delete(item.id);
      }
    }
    this.meals.delete(mealId);
  }

  private toMealPlanRecord(plan: StoredMealPlan): MealPlanRecord {
    return {
      id: plan.id,
      bondId: plan.bondId,
      title: plan.title,
      normalizationAnchor: plan.normalizationAnchor,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  private toMealRecord(meal: StoredMeal): MealRecord {
    return {
      id: meal.id,
      mealPlanId: meal.mealPlanId,
      moment: meal.moment,
      freeText: meal.freeText,
      anchorOverride: meal.anchorOverride,
      position: meal.position,
      createdAt: meal.createdAt,
      updatedAt: meal.updatedAt,
    };
  }

  private toMealDetailRecord(meal: StoredMeal): MealDetailRecord {
    const items = [...this.items.values()]
      .filter((item) => item.mealId === meal.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => this.toItemRecord(item));
    return { ...this.toMealRecord(meal), items };
  }

  private toItemRecord(item: StoredItem): MealPlanItemRecord {
    return {
      id: item.id,
      mealId: item.mealId,
      foodId: item.foodId,
      foodGroupId: item.foodGroupId,
      freeText: item.freeText,
      quantityGrams: item.quantityGrams,
      portionQuantity: item.portionQuantity,
      position: item.position,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toFoodRecord(food: StoredFood): FoodRecord {
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

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }
}

import type { FoodSource, MealMoment, NormalizationAnchor } from '@fitvo/database';

/** Projecao do plano alimentar (resumo, sem a arvore de refeicoes). */
export interface MealPlanRecord {
  id: string;
  bondId: string;
  title: string;
  normalizationAnchor: NormalizationAnchor;
  createdAt: Date;
  updatedAt: Date;
}

export interface MealPlanItemRecord {
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

export interface MealRecord {
  id: string;
  mealPlanId: string;
  moment: MealMoment;
  freeText: string | null;
  anchorOverride: NormalizationAnchor | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MealDetailRecord extends MealRecord {
  items: MealPlanItemRecord[];
}

export interface MealPlanDetailRecord extends MealPlanRecord {
  meals: MealDetailRecord[];
}

export interface FoodRecord {
  id: string;
  name: string;
  source: FoodSource;
  referencePortionGrams: number;
  energyKcal: number | null;
  proteinMg: number | null;
  carbMg: number | null;
  fatMg: number | null;
}

export interface CreateMealPlanInput {
  tenantId: string;
  bondId: string;
  title: string;
  normalizationAnchor?: NormalizationAnchor | undefined;
}

export interface UpdateMealPlanPatch {
  title?: string | undefined;
  normalizationAnchor?: NormalizationAnchor | undefined;
}

export interface CreateMealInput {
  moment: MealMoment;
  freeText?: string | null | undefined;
  anchorOverride?: NormalizationAnchor | null | undefined;
  position?: number | undefined;
}

export interface UpdateMealPatch {
  moment?: MealMoment | undefined;
  freeText?: string | null | undefined;
  anchorOverride?: NormalizationAnchor | null | undefined;
  position?: number | undefined;
}

export interface CreateMealPlanItemInput {
  foodId?: string | null | undefined;
  quantityGrams?: number | null | undefined;
  foodGroupId?: string | null | undefined;
  portionQuantity?: number | null | undefined;
  freeText?: string | null | undefined;
  position?: number | undefined;
}

export type UpdateMealPlanItemPatch = CreateMealPlanItemInput;

/**
 * Porta de persistencia da slice de nutricao — fatia 1 (montagem do plano:
 * MealPlan -> Meal -> MealPlanItem, D-112/D-114/D-115 — ADR-0013). Isolamento
 * de tenant e por VINCULO (D-002/ADR-0001): toda operacao escopada por
 * `tenantId` + `professionalProfileId` (dono do bond), nunca so por id do
 * recurso. `null`/`false` de retorno = recurso inexistente OU fora do escopo
 * do chamador (o service traduz para 404 — mesma politica do `NotFoundError`).
 */
export interface NutritionRepository {
  /** Perfil profissional do chamador NESTE tenant (base do guard — D-002). */
  findProfessional(
    accountId: string,
    tenantId: string,
  ): Promise<{ professionalProfileId: string } | null>;

  /** O vinculo existe e pertence a este profissional neste tenant? */
  findBond(
    tenantId: string,
    professionalProfileId: string,
    bondId: string,
  ): Promise<{ id: string } | null>;

  createMealPlan(input: CreateMealPlanInput): Promise<MealPlanRecord>;

  listMealPlans(tenantId: string, bondId: string): Promise<MealPlanRecord[]>;

  /** Plano com a arvore completa (refeicoes + itens), escopado ao dono do vinculo. */
  findMealPlanDetail(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
  ): Promise<MealPlanDetailRecord | null>;

  updateMealPlan(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
    patch: UpdateMealPlanPatch,
  ): Promise<MealPlanRecord | null>;

  deleteMealPlan(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
  ): Promise<boolean>;

  createMeal(
    tenantId: string,
    professionalProfileId: string,
    mealPlanId: string,
    input: CreateMealInput,
  ): Promise<MealRecord | null>;

  updateMeal(
    tenantId: string,
    professionalProfileId: string,
    mealId: string,
    patch: UpdateMealPatch,
  ): Promise<MealRecord | null>;

  deleteMeal(tenantId: string, professionalProfileId: string, mealId: string): Promise<boolean>;

  createMealPlanItem(
    tenantId: string,
    professionalProfileId: string,
    mealId: string,
    input: CreateMealPlanItemInput,
  ): Promise<MealPlanItemRecord | null>;

  updateMealPlanItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
    patch: UpdateMealPlanItemPatch,
  ): Promise<MealPlanItemRecord | null>;

  deleteMealPlanItem(
    tenantId: string,
    professionalProfileId: string,
    itemId: string,
  ): Promise<boolean>;

  /**
   * Busca de montagem (D-117): SEMPRE exclui `source=OPEN_FOOD_FACTS` (a base
   * aberta so entra no registro livre, nunca na montagem do plano). Escopo:
   * itens da plataforma (sem dono) OU proprios do profissional.
   */
  searchFoods(professionalProfileId: string, query: string): Promise<FoodRecord[]>;
}

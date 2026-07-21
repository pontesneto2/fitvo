import { z } from 'zod';

/**
 * Contrato do domínio de nutrição (ADR-0013/D-032) — fonte única. Fatia 1:
 * montagem do plano alimentar (MealPlan -> Meal -> MealPlanItem) + busca de
 * Food para montagem. Nomes prefixados com `nutrition` (barrel flat).
 */

const normalizationAnchor = z
  .enum(['CALORIES', 'PROTEIN', 'CARB', 'FAT'])
  .describe('Ancora da normalizacao calorica automatica (D-114 emenda).');

const mealMoment = z
  .enum([
    'CAFE_DA_MANHA',
    'LANCHE_DA_MANHA',
    'ALMOCO',
    'LANCHE_DA_TARDE',
    'PRE_TREINO',
    'POS_TREINO',
    'JANTAR',
    'CEIA',
  ])
  .describe('Momento do dia da refeicao (catalogo fixo — D-113).');

const foodSource = z
  .enum(['TACO', 'TBCA', 'OPEN_FOOD_FACTS', 'PROFESSIONAL_CUSTOM'])
  .describe('Origem/tabela do alimento (D-117).');

// ---- Params ----
export const nutritionTenantParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
});

export const nutritionBondParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
  bondId: z.string().min(1).describe('ID do vinculo (D-002).'),
});

export const nutritionMealPlanParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
  mealPlanId: z.string().min(1).describe('ID do plano alimentar.'),
});

export const nutritionMealParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
  mealId: z.string().min(1).describe('ID da refeicao.'),
});

export const nutritionItemParamsSchema = z.object({
  tenantId: z.string().min(1).describe('ID do tenant do profissional.'),
  itemId: z.string().min(1).describe('ID do item da refeicao.'),
});

export const nutritionFoodSearchQuerySchema = z.object({
  query: z.string().min(1).describe('Termo de busca (nome do alimento).'),
});

// ---- MealPlan ----
export const nutritionCreateMealPlanSchema = z.object({
  title: z.string().min(1),
  normalizationAnchor: normalizationAnchor.optional(),
});

export const nutritionUpdateMealPlanSchema = z
  .object({
    title: z.string().min(1).optional(),
    normalizationAnchor: normalizationAnchor.optional(),
  })
  .refine((body) => body.title !== undefined || body.normalizationAnchor !== undefined, {
    message: 'Informe ao menos um campo para atualizar.',
  });

// ---- Meal ----
export const nutritionCreateMealSchema = z.object({
  moment: mealMoment,
  freeText: z.string().min(1).nullish(),
  anchorOverride: normalizationAnchor.nullish(),
  position: z.number().int().min(0).optional(),
});

export const nutritionUpdateMealSchema = z
  .object({
    moment: mealMoment.optional(),
    freeText: z.string().min(1).nullish(),
    anchorOverride: normalizationAnchor.nullish(),
    position: z.number().int().min(0).optional(),
  })
  .refine(
    (body) =>
      body.moment !== undefined ||
      body.freeText !== undefined ||
      body.anchorOverride !== undefined ||
      body.position !== undefined,
    { message: 'Informe ao menos um campo para atualizar.' },
  );

// ---- MealPlanItem ----
// XOR de dominio (D-114/D-115): exatamente um modo — alimento (foodId +
// quantityGrams), grupo (foodGroupId + portionQuantity) ou texto livre
// (freeText). Nao e trava de banco; e a fonte unica de validacao (D-032).
const mealPlanItemModeSchema = z
  .object({
    foodId: z.string().min(1).nullish(),
    quantityGrams: z.number().int().positive().nullish(),
    foodGroupId: z.string().min(1).nullish(),
    portionQuantity: z.number().int().positive().nullish(),
    freeText: z.string().min(1).nullish(),
  })
  .refine(
    (body) => {
      const isFoodMode = Boolean(body.foodId) && Boolean(body.quantityGrams);
      const isGroupMode = Boolean(body.foodGroupId) && Boolean(body.portionQuantity);
      const isFreeTextMode = Boolean(body.freeText);
      const noCrossFields =
        (isFoodMode && !body.foodGroupId && !body.freeText && !body.portionQuantity) ||
        (isGroupMode && !body.foodId && !body.freeText && !body.quantityGrams) ||
        (isFreeTextMode &&
          !body.foodId &&
          !body.quantityGrams &&
          !body.foodGroupId &&
          !body.portionQuantity);
      const exactlyOneMode = [isFoodMode, isGroupMode, isFreeTextMode].filter(Boolean).length === 1;
      return exactlyOneMode && noCrossFields;
    },
    {
      message:
        'Informe exatamente um modo: alimento (foodId + quantityGrams), grupo ' +
        '(foodGroupId + portionQuantity) ou texto livre (freeText).',
    },
  );

export const nutritionCreateMealPlanItemSchema = z.intersection(
  mealPlanItemModeSchema,
  z.object({ position: z.number().int().min(0).optional() }),
);

export const nutritionUpdateMealPlanItemSchema = nutritionCreateMealPlanItemSchema;

// ---- Response ----
export const nutritionMealPlanItemViewSchema = z.object({
  id: z.string(),
  mealId: z.string(),
  foodId: z.string().nullable(),
  foodGroupId: z.string().nullable(),
  freeText: z.string().nullable(),
  quantityGrams: z.number().int().nullable(),
  portionQuantity: z.number().int().nullable(),
  position: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const nutritionMealViewSchema = z.object({
  id: z.string(),
  mealPlanId: z.string(),
  moment: mealMoment,
  freeText: z.string().nullable(),
  anchorOverride: normalizationAnchor.nullable(),
  position: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const nutritionMealDetailViewSchema = nutritionMealViewSchema.extend({
  items: z.array(nutritionMealPlanItemViewSchema),
});

export const nutritionMealPlanSummaryViewSchema = z.object({
  id: z.string(),
  bondId: z.string(),
  title: z.string(),
  normalizationAnchor,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const nutritionMealPlanDetailViewSchema = nutritionMealPlanSummaryViewSchema.extend({
  meals: z.array(nutritionMealDetailViewSchema),
});

export const nutritionMealPlanListResultSchema = z.object({
  mealPlans: z.array(nutritionMealPlanSummaryViewSchema),
});

export const nutritionFoodViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: foodSource,
  referencePortionGrams: z.number().int(),
  energyKcal: z.number().int().nullable(),
  proteinMg: z.number().int().nullable(),
  carbMg: z.number().int().nullable(),
  fatMg: z.number().int().nullable(),
});

export const nutritionFoodSearchResultSchema = z.object({
  foods: z.array(nutritionFoodViewSchema),
});

// ---- Tipos de wire ----
export type NutritionTenantParams = z.infer<typeof nutritionTenantParamsSchema>;
export type NutritionBondParams = z.infer<typeof nutritionBondParamsSchema>;
export type NutritionMealPlanParams = z.infer<typeof nutritionMealPlanParamsSchema>;
export type NutritionMealParams = z.infer<typeof nutritionMealParamsSchema>;
export type NutritionItemParams = z.infer<typeof nutritionItemParamsSchema>;
export type NutritionFoodSearchQuery = z.infer<typeof nutritionFoodSearchQuerySchema>;
export type NutritionCreateMealPlanInput = z.infer<typeof nutritionCreateMealPlanSchema>;
export type NutritionUpdateMealPlanInput = z.infer<typeof nutritionUpdateMealPlanSchema>;
export type NutritionCreateMealInput = z.infer<typeof nutritionCreateMealSchema>;
export type NutritionUpdateMealInput = z.infer<typeof nutritionUpdateMealSchema>;
export type NutritionCreateMealPlanItemInput = z.infer<typeof nutritionCreateMealPlanItemSchema>;
export type NutritionUpdateMealPlanItemInput = z.infer<typeof nutritionUpdateMealPlanItemSchema>;
export type NutritionMealPlanItemView = z.infer<typeof nutritionMealPlanItemViewSchema>;
export type NutritionMealView = z.infer<typeof nutritionMealViewSchema>;
export type NutritionMealDetailView = z.infer<typeof nutritionMealDetailViewSchema>;
export type NutritionMealPlanSummaryView = z.infer<typeof nutritionMealPlanSummaryViewSchema>;
export type NutritionMealPlanDetailView = z.infer<typeof nutritionMealPlanDetailViewSchema>;
export type NutritionFoodView = z.infer<typeof nutritionFoodViewSchema>;

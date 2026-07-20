/*
  Warnings:

  - You are about to drop the column `detail` on the `meal_plan` table. All the data in the column will be lost.
  - You are about to drop the column `detail` on the `meal_plan_item` table. All the data in the column will be lost.
  - You are about to drop the column `mealPlanId` on the `meal_plan_item` table. All the data in the column will be lost.
  - Added the required column `source` to the `food` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mealId` to the `meal_plan_item` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('TACO', 'TBCA', 'OPEN_FOOD_FACTS', 'PROFESSIONAL_CUSTOM');

-- CreateEnum
CREATE TYPE "NormalizationAnchor" AS ENUM ('CALORIES', 'PROTEIN', 'CARB', 'FAT');

-- CreateEnum
CREATE TYPE "MealMoment" AS ENUM ('CAFE_DA_MANHA', 'LANCHE_DA_MANHA', 'ALMOCO', 'LANCHE_DA_TARDE', 'PRE_TREINO', 'POS_TREINO', 'JANTAR', 'CEIA');

-- CreateEnum
CREATE TYPE "MealLogStatus" AS ENUM ('ATE_ALL', 'PARTIAL', 'SKIPPED');

-- DropForeignKey
ALTER TABLE "meal_plan_item" DROP CONSTRAINT "meal_plan_item_mealPlanId_fkey";

-- DropIndex
DROP INDEX "meal_plan_item_mealPlanId_idx";

-- AlterTable
ALTER TABLE "food" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "carbMg" INTEGER,
ADD COLUMN     "energyKcal" INTEGER,
ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "fatMg" INTEGER,
ADD COLUMN     "proteinMg" INTEGER,
ADD COLUMN     "referencePortionGrams" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "source" "FoodSource" NOT NULL;

-- AlterTable
ALTER TABLE "meal_plan" DROP COLUMN "detail",
ADD COLUMN     "normalizationAnchor" "NormalizationAnchor" NOT NULL DEFAULT 'CALORIES';

-- AlterTable
ALTER TABLE "meal_plan_item" DROP COLUMN "detail",
DROP COLUMN "mealPlanId",
ADD COLUMN     "foodGroupId" TEXT,
ADD COLUMN     "freeText" TEXT,
ADD COLUMN     "mealId" TEXT NOT NULL,
ADD COLUMN     "portionQuantity" INTEGER,
ADD COLUMN     "quantityGrams" INTEGER;

-- CreateTable
CREATE TABLE "food_group" (
    "id" TEXT NOT NULL,
    "ownerProfessionalProfileId" TEXT,
    "specialtyId" TEXT,
    "name" TEXT NOT NULL,
    "visibility" "LibraryVisibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "LibraryItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "food_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_group_member" (
    "id" TEXT NOT NULL,
    "foodGroupId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "referencePortionGrams" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "food_group_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "moment" "MealMoment" NOT NULL,
    "freeText" TEXT,
    "anchorOverride" "NormalizationAnchor",
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_log" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "status" "MealLogStatus" NOT NULL,
    "comment" TEXT,
    "photoStorageKey" TEXT,
    "loggedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "meal_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_log_item" (
    "id" TEXT NOT NULL,
    "mealLogId" TEXT NOT NULL,
    "foodId" TEXT,
    "barcode" TEXT,
    "label" TEXT NOT NULL,
    "quantityGrams" INTEGER,
    "frozenEnergyKcal" INTEGER,
    "frozenProteinMg" INTEGER,
    "frozenCarbMg" INTEGER,
    "frozenFatMg" INTEGER,
    "hasNutritionGap" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "meal_log_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "food_group_ownerProfessionalProfileId_idx" ON "food_group"("ownerProfessionalProfileId");

-- CreateIndex
CREATE INDEX "food_group_specialtyId_idx" ON "food_group"("specialtyId");

-- CreateIndex
CREATE INDEX "food_group_visibility_idx" ON "food_group"("visibility");

-- CreateIndex
CREATE INDEX "food_group_status_idx" ON "food_group"("status");

-- CreateIndex
CREATE INDEX "food_group_member_foodId_idx" ON "food_group_member"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "food_group_member_foodGroupId_foodId_key" ON "food_group_member"("foodGroupId", "foodId");

-- CreateIndex
CREATE INDEX "meal_mealPlanId_position_idx" ON "meal"("mealPlanId", "position");

-- CreateIndex
CREATE INDEX "meal_log_bondId_loggedAt_idx" ON "meal_log"("bondId", "loggedAt");

-- CreateIndex
CREATE INDEX "meal_log_tenantId_loggedAt_idx" ON "meal_log"("tenantId", "loggedAt");

-- CreateIndex
CREATE INDEX "meal_log_mealId_idx" ON "meal_log"("mealId");

-- CreateIndex
CREATE INDEX "meal_log_bondId_updatedAt_idx" ON "meal_log"("bondId", "updatedAt");

-- CreateIndex
CREATE INDEX "meal_log_item_mealLogId_idx" ON "meal_log_item"("mealLogId");

-- CreateIndex
CREATE INDEX "meal_log_item_foodId_idx" ON "meal_log_item"("foodId");

-- CreateIndex
CREATE INDEX "food_source_idx" ON "food"("source");

-- CreateIndex
CREATE INDEX "food_barcode_idx" ON "food"("barcode");

-- CreateIndex
CREATE INDEX "meal_plan_item_mealId_position_idx" ON "meal_plan_item"("mealId", "position");

-- CreateIndex
CREATE INDEX "meal_plan_item_foodGroupId_idx" ON "meal_plan_item"("foodGroupId");

-- AddForeignKey
ALTER TABLE "food_group" ADD CONSTRAINT "food_group_ownerProfessionalProfileId_fkey" FOREIGN KEY ("ownerProfessionalProfileId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_group" ADD CONSTRAINT "food_group_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_group_member" ADD CONSTRAINT "food_group_member_foodGroupId_fkey" FOREIGN KEY ("foodGroupId") REFERENCES "food_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_group_member" ADD CONSTRAINT "food_group_member_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal" ADD CONSTRAINT "meal_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "meal_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_item" ADD CONSTRAINT "meal_plan_item_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_item" ADD CONSTRAINT "meal_plan_item_foodGroupId_fkey" FOREIGN KEY ("foodGroupId") REFERENCES "food_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log" ADD CONSTRAINT "meal_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log" ADD CONSTRAINT "meal_log_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log" ADD CONSTRAINT "meal_log_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log_item" ADD CONSTRAINT "meal_log_item_mealLogId_fkey" FOREIGN KEY ("mealLogId") REFERENCES "meal_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_log_item" ADD CONSTRAINT "meal_log_item_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

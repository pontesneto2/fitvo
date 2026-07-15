-- CreateEnum
CREATE TYPE "LibraryVisibility" AS ENUM ('PLATFORM', 'PRIVATE');

-- CreateTable
CREATE TABLE "exercise" (
    "id" TEXT NOT NULL,
    "ownerProfessionalProfileId" TEXT,
    "specialtyId" TEXT,
    "name" TEXT NOT NULL,
    "visibility" "LibraryVisibility" NOT NULL DEFAULT 'PRIVATE',
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_item" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food" (
    "id" TEXT NOT NULL,
    "ownerProfessionalProfileId" TEXT,
    "specialtyId" TEXT,
    "name" TEXT NOT NULL,
    "visibility" "LibraryVisibility" NOT NULL DEFAULT 'PRIVATE',
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_item" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "foodId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_plan_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_record" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_photo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exercise_ownerProfessionalProfileId_idx" ON "exercise"("ownerProfessionalProfileId");

-- CreateIndex
CREATE INDEX "exercise_specialtyId_idx" ON "exercise"("specialtyId");

-- CreateIndex
CREATE INDEX "exercise_visibility_idx" ON "exercise"("visibility");

-- CreateIndex
CREATE INDEX "workout_bondId_idx" ON "workout"("bondId");

-- CreateIndex
CREATE INDEX "workout_tenantId_idx" ON "workout"("tenantId");

-- CreateIndex
CREATE INDEX "workout_item_workoutId_idx" ON "workout_item"("workoutId");

-- CreateIndex
CREATE INDEX "workout_item_exerciseId_idx" ON "workout_item"("exerciseId");

-- CreateIndex
CREATE INDEX "food_ownerProfessionalProfileId_idx" ON "food"("ownerProfessionalProfileId");

-- CreateIndex
CREATE INDEX "food_specialtyId_idx" ON "food"("specialtyId");

-- CreateIndex
CREATE INDEX "food_visibility_idx" ON "food"("visibility");

-- CreateIndex
CREATE INDEX "meal_plan_bondId_idx" ON "meal_plan"("bondId");

-- CreateIndex
CREATE INDEX "meal_plan_tenantId_idx" ON "meal_plan"("tenantId");

-- CreateIndex
CREATE INDEX "meal_plan_item_mealPlanId_idx" ON "meal_plan_item"("mealPlanId");

-- CreateIndex
CREATE INDEX "meal_plan_item_foodId_idx" ON "meal_plan_item"("foodId");

-- CreateIndex
CREATE INDEX "encounter_bondId_idx" ON "encounter"("bondId");

-- CreateIndex
CREATE INDEX "encounter_tenantId_idx" ON "encounter"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "medical_record_bondId_key" ON "medical_record"("bondId");

-- CreateIndex
CREATE INDEX "medical_record_tenantId_idx" ON "medical_record"("tenantId");

-- CreateIndex
CREATE INDEX "prescription_encounterId_idx" ON "prescription"("encounterId");

-- CreateIndex
CREATE INDEX "prescription_tenantId_idx" ON "prescription"("tenantId");

-- CreateIndex
CREATE INDEX "assessment_bondId_idx" ON "assessment"("bondId");

-- CreateIndex
CREATE INDEX "assessment_tenantId_idx" ON "assessment"("tenantId");

-- CreateIndex
CREATE INDEX "progress_photo_bondId_idx" ON "progress_photo"("bondId");

-- CreateIndex
CREATE INDEX "progress_photo_tenantId_idx" ON "progress_photo"("tenantId");

-- AddForeignKey
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_ownerProfessionalProfileId_fkey" FOREIGN KEY ("ownerProfessionalProfileId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout" ADD CONSTRAINT "workout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout" ADD CONSTRAINT "workout_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_item" ADD CONSTRAINT "workout_item_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_item" ADD CONSTRAINT "workout_item_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food" ADD CONSTRAINT "food_ownerProfessionalProfileId_fkey" FOREIGN KEY ("ownerProfessionalProfileId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food" ADD CONSTRAINT "food_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_item" ADD CONSTRAINT "meal_plan_item_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "meal_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_item" ADD CONSTRAINT "meal_plan_item_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter" ADD CONSTRAINT "encounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter" ADD CONSTRAINT "encounter_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_record" ADD CONSTRAINT "medical_record_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_record" ADD CONSTRAINT "medical_record_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_photo" ADD CONSTRAINT "progress_photo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_photo" ADD CONSTRAINT "progress_photo_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

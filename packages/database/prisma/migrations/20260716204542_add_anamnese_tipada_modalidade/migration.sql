/*
  Warnings:

  - You are about to drop the column `detail` on the `anamnesis` table. All the data in the column will be lost.
  - Added the required column `modality` to the `bond` table without a default value. This is not possible if the table is not empty.
  - Added the required column `modality` to the `patient_invite` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CareModality" AS ENUM ('ONLINE', 'PRESENCIAL', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "AnamnesisAuthor" AS ENUM ('PATIENT', 'PROFESSIONAL');

-- AlterTable
ALTER TABLE "anamnesis" DROP COLUMN "detail";

-- AlterTable
ALTER TABLE "bond" ADD COLUMN     "modality" "CareModality" NOT NULL;

-- AlterTable
ALTER TABLE "patient_invite" ADD COLUMN     "modality" "CareModality" NOT NULL;

-- CreateTable
CREATE TABLE "anamnesis_parq" (
    "id" TEXT NOT NULL,
    "anamnesisId" TEXT NOT NULL,
    "heartCondition" BOOLEAN NOT NULL,
    "chestPainDuringActivity" BOOLEAN NOT NULL,
    "chestPainAtRest" BOOLEAN NOT NULL,
    "dizzinessOrFainting" BOOLEAN NOT NULL,
    "boneOrJointProblem" BOOLEAN NOT NULL,
    "bloodPressureOrHeartMedication" BOOLEAN NOT NULL,
    "otherReason" BOOLEAN NOT NULL,
    "otherReasonDetail" TEXT,
    "authoredBy" "AnamnesisAuthor" NOT NULL,
    "authoredByAccountId" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_parq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_goal" (
    "id" TEXT NOT NULL,
    "anamnesisId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "expectation" TEXT,
    "authoredBy" "AnamnesisAuthor" NOT NULL,
    "authoredByAccountId" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_clinical_history" (
    "id" TEXT NOT NULL,
    "anamnesisId" TEXT NOT NULL,
    "hasConditions" BOOLEAN NOT NULL,
    "hasSurgeries" BOOLEAN NOT NULL,
    "takesMedication" BOOLEAN NOT NULL,
    "hasAllergies" BOOLEAN NOT NULL,
    "authoredBy" "AnamnesisAuthor" NOT NULL,
    "authoredByAccountId" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_clinical_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_condition" (
    "id" TEXT NOT NULL,
    "clinicalHistoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_surgery" (
    "id" TEXT NOT NULL,
    "clinicalHistoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_surgery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_medication" (
    "id" TEXT NOT NULL,
    "clinicalHistoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "posology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_allergy" (
    "id" TEXT NOT NULL,
    "clinicalHistoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reaction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_family_history" (
    "id" TEXT NOT NULL,
    "anamnesisId" TEXT NOT NULL,
    "hasFamilyHistory" BOOLEAN NOT NULL,
    "authoredBy" "AnamnesisAuthor" NOT NULL,
    "authoredByAccountId" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_family_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_family_condition" (
    "id" TEXT NOT NULL,
    "familyHistoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_family_condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_lifestyle" (
    "id" TEXT NOT NULL,
    "anamnesisId" TEXT NOT NULL,
    "sleepHoursPerNight" INTEGER,
    "stressLevel" INTEGER,
    "smokes" BOOLEAN NOT NULL,
    "smokingNote" TEXT,
    "drinksAlcohol" BOOLEAN NOT NULL,
    "alcoholNote" TEXT,
    "authoredBy" "AnamnesisAuthor" NOT NULL,
    "authoredByAccountId" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_lifestyle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_emergency_contact" (
    "id" TEXT NOT NULL,
    "anamnesisId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT,
    "authoredBy" "AnamnesisAuthor" NOT NULL,
    "authoredByAccountId" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_emergency_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_training" (
    "id" TEXT NOT NULL,
    "anamnesisId" TEXT NOT NULL,
    "hasPreviousExperience" BOOLEAN NOT NULL,
    "previousExperience" TEXT,
    "availableDaysPerWeek" INTEGER,
    "preferredTime" TEXT,
    "hasInjury" BOOLEAN NOT NULL,
    "usesAnabolicSteroids" BOOLEAN NOT NULL,
    "anabolicSteroidsNote" TEXT,
    "preferences" TEXT,
    "aversions" TEXT,
    "authoredBy" "AnamnesisAuthor" NOT NULL,
    "authoredByAccountId" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis_injury" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "bodyRegion" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sinceYear" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_injury_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_parq_anamnesisId_key" ON "anamnesis_parq"("anamnesisId");

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_goal_anamnesisId_key" ON "anamnesis_goal"("anamnesisId");

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_clinical_history_anamnesisId_key" ON "anamnesis_clinical_history"("anamnesisId");

-- CreateIndex
CREATE INDEX "anamnesis_condition_clinicalHistoryId_idx" ON "anamnesis_condition"("clinicalHistoryId");

-- CreateIndex
CREATE INDEX "anamnesis_surgery_clinicalHistoryId_idx" ON "anamnesis_surgery"("clinicalHistoryId");

-- CreateIndex
CREATE INDEX "anamnesis_medication_clinicalHistoryId_idx" ON "anamnesis_medication"("clinicalHistoryId");

-- CreateIndex
CREATE INDEX "anamnesis_allergy_clinicalHistoryId_idx" ON "anamnesis_allergy"("clinicalHistoryId");

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_family_history_anamnesisId_key" ON "anamnesis_family_history"("anamnesisId");

-- CreateIndex
CREATE INDEX "anamnesis_family_condition_familyHistoryId_idx" ON "anamnesis_family_condition"("familyHistoryId");

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_lifestyle_anamnesisId_key" ON "anamnesis_lifestyle"("anamnesisId");

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_emergency_contact_anamnesisId_key" ON "anamnesis_emergency_contact"("anamnesisId");

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_training_anamnesisId_key" ON "anamnesis_training"("anamnesisId");

-- CreateIndex
CREATE INDEX "anamnesis_injury_trainingId_idx" ON "anamnesis_injury"("trainingId");

-- AddForeignKey
ALTER TABLE "anamnesis_parq" ADD CONSTRAINT "anamnesis_parq_anamnesisId_fkey" FOREIGN KEY ("anamnesisId") REFERENCES "anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_parq" ADD CONSTRAINT "anamnesis_parq_authoredByAccountId_fkey" FOREIGN KEY ("authoredByAccountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_goal" ADD CONSTRAINT "anamnesis_goal_anamnesisId_fkey" FOREIGN KEY ("anamnesisId") REFERENCES "anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_goal" ADD CONSTRAINT "anamnesis_goal_authoredByAccountId_fkey" FOREIGN KEY ("authoredByAccountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_clinical_history" ADD CONSTRAINT "anamnesis_clinical_history_anamnesisId_fkey" FOREIGN KEY ("anamnesisId") REFERENCES "anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_clinical_history" ADD CONSTRAINT "anamnesis_clinical_history_authoredByAccountId_fkey" FOREIGN KEY ("authoredByAccountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_condition" ADD CONSTRAINT "anamnesis_condition_clinicalHistoryId_fkey" FOREIGN KEY ("clinicalHistoryId") REFERENCES "anamnesis_clinical_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_surgery" ADD CONSTRAINT "anamnesis_surgery_clinicalHistoryId_fkey" FOREIGN KEY ("clinicalHistoryId") REFERENCES "anamnesis_clinical_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_medication" ADD CONSTRAINT "anamnesis_medication_clinicalHistoryId_fkey" FOREIGN KEY ("clinicalHistoryId") REFERENCES "anamnesis_clinical_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_allergy" ADD CONSTRAINT "anamnesis_allergy_clinicalHistoryId_fkey" FOREIGN KEY ("clinicalHistoryId") REFERENCES "anamnesis_clinical_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_family_history" ADD CONSTRAINT "anamnesis_family_history_anamnesisId_fkey" FOREIGN KEY ("anamnesisId") REFERENCES "anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_family_history" ADD CONSTRAINT "anamnesis_family_history_authoredByAccountId_fkey" FOREIGN KEY ("authoredByAccountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_family_condition" ADD CONSTRAINT "anamnesis_family_condition_familyHistoryId_fkey" FOREIGN KEY ("familyHistoryId") REFERENCES "anamnesis_family_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_lifestyle" ADD CONSTRAINT "anamnesis_lifestyle_anamnesisId_fkey" FOREIGN KEY ("anamnesisId") REFERENCES "anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_lifestyle" ADD CONSTRAINT "anamnesis_lifestyle_authoredByAccountId_fkey" FOREIGN KEY ("authoredByAccountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_emergency_contact" ADD CONSTRAINT "anamnesis_emergency_contact_anamnesisId_fkey" FOREIGN KEY ("anamnesisId") REFERENCES "anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_emergency_contact" ADD CONSTRAINT "anamnesis_emergency_contact_authoredByAccountId_fkey" FOREIGN KEY ("authoredByAccountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_training" ADD CONSTRAINT "anamnesis_training_anamnesisId_fkey" FOREIGN KEY ("anamnesisId") REFERENCES "anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_training" ADD CONSTRAINT "anamnesis_training_authoredByAccountId_fkey" FOREIGN KEY ("authoredByAccountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis_injury" ADD CONSTRAINT "anamnesis_injury_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "anamnesis_training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

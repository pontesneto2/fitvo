/*
  Warnings:

  - You are about to drop the column `detail` on the `exercise` table. All the data in the column will be lost.
  - You are about to drop the column `detail` on the `workout` table. All the data in the column will be lost.
  - You are about to drop the column `detail` on the `workout_item` table. All the data in the column will be lost.
  - Added the required column `planId` to the `workout` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LibraryItemStatus" AS ENUM ('ACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "PlanOrganization" AS ENUM ('LETTER', 'WEEKDAY');

-- CreateEnum
CREATE TYPE "WorkoutPlanStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "SetTechnique" AS ENUM ('NORMAL', 'DROP_SET');

-- CreateEnum
CREATE TYPE "WorkoutReaction" AS ENUM ('DIED', 'FLEW', 'WOBBLY_LEGS');

-- CreateEnum
CREATE TYPE "WorkoutSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FormAnalysisAiStatus" AS ENUM ('PENDING', 'ANALYZED', 'FAILED');

-- CreateEnum
CREATE TYPE "FormAnalysisReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AnamnesisStatus" AS ENUM ('PENDING', 'ANSWERED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WORKOUT_DAY', 'PLAN_EXPIRING', 'ATTENDANCE_UNANSWERED', 'INVITE_RECEIVED', 'CHARGE', 'ACHIEVEMENT');

-- DropForeignKey
ALTER TABLE "workout_item" DROP CONSTRAINT "workout_item_exerciseId_fkey";

-- DropIndex
DROP INDEX "workout_item_workoutId_idx";

-- AlterTable
ALTER TABLE "exercise" DROP COLUMN "detail",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "status" "LibraryItemStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "videoStorageKey" TEXT;

-- AlterTable
ALTER TABLE "food" ADD COLUMN     "status" "LibraryItemStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "patient_profile" ADD COLUMN     "lastCadastralReviewAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workout" DROP COLUMN "detail",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "label" TEXT,
ADD COLUMN     "planId" TEXT NOT NULL,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weekday" "Weekday";

-- AlterTable
ALTER TABLE "workout_item" DROP COLUMN "detail",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "supersetGroup" INTEGER,
ADD COLUMN     "supersetOrder" INTEGER;

-- CreateTable
CREATE TABLE "workout_plan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" "PlanOrganization" NOT NULL,
    "status" "WorkoutPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "validityDays" INTEGER NOT NULL DEFAULT 30,
    "validUntil" TIMESTAMP(3),
    "releaseAt" TIMESTAMP(3),
    "goal" TEXT,
    "clonedFromWorkoutPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workout_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_set" (
    "id" TEXT NOT NULL,
    "workoutItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "reps" INTEGER,
    "repsToFailure" BOOLEAN NOT NULL DEFAULT false,
    "weightGrams" INTEGER,
    "durationSeconds" INTEGER,
    "distanceMeters" INTEGER,
    "bodyweight" BOOLEAN NOT NULL DEFAULT false,
    "restSeconds" INTEGER,
    "technique" "SetTechnique" NOT NULL DEFAULT 'NORMAL',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workout_set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_session" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "performedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workout_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_log" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "workoutSetId" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "actualReps" INTEGER,
    "actualWeightGrams" INTEGER,
    "actualDurationSeconds" INTEGER,
    "actualDistanceMeters" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "set_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_rating" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "perceivedEffort" INTEGER NOT NULL,
    "comment" TEXT,
    "reactions" "WorkoutReaction"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workout_rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_analysis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "sessionId" TEXT,
    "videoStorageKey" TEXT NOT NULL,
    "aiStatus" "FormAnalysisAiStatus" NOT NULL DEFAULT 'PENDING',
    "aiResult" JSONB,
    "reviewStatus" "FormAnalysisReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByProfessionalProfile" TEXT,
    "professionalFeedback" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "form_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anamnesis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "status" "AnamnesisStatus" NOT NULL DEFAULT 'PENDING',
    "answeredAt" TIMESTAMP(3),
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "openedByAccountId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_message" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "senderAccountId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_rating" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workout_plan_bondId_status_idx" ON "workout_plan"("bondId", "status");

-- CreateIndex
CREATE INDEX "workout_plan_tenantId_idx" ON "workout_plan"("tenantId");

-- CreateIndex
CREATE INDEX "workout_plan_status_validUntil_idx" ON "workout_plan"("status", "validUntil");

-- CreateIndex
CREATE INDEX "workout_plan_status_releaseAt_idx" ON "workout_plan"("status", "releaseAt");

-- CreateIndex
CREATE INDEX "workout_plan_bondId_updatedAt_idx" ON "workout_plan"("bondId", "updatedAt");

-- CreateIndex
CREATE INDEX "workout_set_workoutItemId_idx" ON "workout_set"("workoutItemId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_set_workoutItemId_position_key" ON "workout_set"("workoutItemId", "position");

-- CreateIndex
CREATE INDEX "workout_session_bondId_performedAt_idx" ON "workout_session"("bondId", "performedAt");

-- CreateIndex
CREATE INDEX "workout_session_workoutId_idx" ON "workout_session"("workoutId");

-- CreateIndex
CREATE INDEX "workout_session_tenantId_performedAt_idx" ON "workout_session"("tenantId", "performedAt");

-- CreateIndex
CREATE INDEX "workout_session_bondId_status_idx" ON "workout_session"("bondId", "status");

-- CreateIndex
CREATE INDEX "workout_session_bondId_updatedAt_idx" ON "workout_session"("bondId", "updatedAt");

-- CreateIndex
CREATE INDEX "set_log_sessionId_idx" ON "set_log"("sessionId");

-- CreateIndex
CREATE INDEX "set_log_workoutSetId_idx" ON "set_log"("workoutSetId");

-- CreateIndex
CREATE UNIQUE INDEX "workout_rating_sessionId_key" ON "workout_rating"("sessionId");

-- CreateIndex
CREATE INDEX "workout_rating_score_idx" ON "workout_rating"("score");

-- CreateIndex
CREATE INDEX "form_analysis_bondId_idx" ON "form_analysis"("bondId");

-- CreateIndex
CREATE INDEX "form_analysis_tenantId_idx" ON "form_analysis"("tenantId");

-- CreateIndex
CREATE INDEX "form_analysis_reviewStatus_idx" ON "form_analysis"("reviewStatus");

-- CreateIndex
CREATE INDEX "form_analysis_aiStatus_idx" ON "form_analysis"("aiStatus");

-- CreateIndex
CREATE UNIQUE INDEX "anamnesis_bondId_key" ON "anamnesis"("bondId");

-- CreateIndex
CREATE INDEX "anamnesis_tenantId_idx" ON "anamnesis"("tenantId");

-- CreateIndex
CREATE INDEX "anamnesis_status_idx" ON "anamnesis"("status");

-- CreateIndex
CREATE INDEX "attendance_bondId_status_idx" ON "attendance"("bondId", "status");

-- CreateIndex
CREATE INDEX "attendance_tenantId_status_idx" ON "attendance"("tenantId", "status");

-- CreateIndex
CREATE INDEX "attendance_status_lastMessageAt_idx" ON "attendance"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "attendance_message_attendanceId_createdAt_idx" ON "attendance_message"("attendanceId", "createdAt");

-- CreateIndex
CREATE INDEX "attendance_message_attendanceId_readAt_idx" ON "attendance_message"("attendanceId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_rating_attendanceId_key" ON "attendance_rating"("attendanceId");

-- CreateIndex
CREATE INDEX "notification_accountId_readAt_idx" ON "notification"("accountId", "readAt");

-- CreateIndex
CREATE INDEX "notification_accountId_createdAt_idx" ON "notification"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "exercise_status_idx" ON "exercise"("status");

-- CreateIndex
CREATE INDEX "food_status_idx" ON "food"("status");

-- CreateIndex
CREATE INDEX "patient_profile_lastCadastralReviewAt_idx" ON "patient_profile"("lastCadastralReviewAt");

-- CreateIndex
CREATE INDEX "workout_planId_position_idx" ON "workout"("planId", "position");

-- CreateIndex
CREATE INDEX "workout_bondId_updatedAt_idx" ON "workout"("bondId", "updatedAt");

-- CreateIndex
CREATE INDEX "workout_item_workoutId_position_idx" ON "workout_item"("workoutId", "position");

-- CreateIndex
CREATE INDEX "workout_item_workoutId_supersetGroup_supersetOrder_idx" ON "workout_item"("workoutId", "supersetGroup", "supersetOrder");

-- AddForeignKey
ALTER TABLE "workout_plan" ADD CONSTRAINT "workout_plan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_plan" ADD CONSTRAINT "workout_plan_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout" ADD CONSTRAINT "workout_planId_fkey" FOREIGN KEY ("planId") REFERENCES "workout_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_item" ADD CONSTRAINT "workout_item_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_set" ADD CONSTRAINT "workout_set_workoutItemId_fkey" FOREIGN KEY ("workoutItemId") REFERENCES "workout_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_workoutSetId_fkey" FOREIGN KEY ("workoutSetId") REFERENCES "workout_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_rating" ADD CONSTRAINT "workout_rating_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_analysis" ADD CONSTRAINT "form_analysis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_analysis" ADD CONSTRAINT "form_analysis_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_analysis" ADD CONSTRAINT "form_analysis_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis" ADD CONSTRAINT "anamnesis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anamnesis" ADD CONSTRAINT "anamnesis_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_bondId_fkey" FOREIGN KEY ("bondId") REFERENCES "bond"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_openedByAccountId_fkey" FOREIGN KEY ("openedByAccountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_message" ADD CONSTRAINT "attendance_message_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_message" ADD CONSTRAINT "attendance_message_senderAccountId_fkey" FOREIGN KEY ("senderAccountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_rating" ADD CONSTRAINT "attendance_rating_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

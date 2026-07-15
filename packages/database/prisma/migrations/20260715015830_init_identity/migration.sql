-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('SOLO', 'CLINIC');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CPF', 'CNPJ');

-- CreateEnum
CREATE TYPE "SpecialtyCode" AS ENUM ('TRAINING', 'NUTRITION', 'MEDICINE');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_ANALYSIS', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClinicRole" AS ENUM ('CLINIC_ADMIN');

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "preferredLocale" TEXT NOT NULL DEFAULT 'pt-BR',
    "preferredTimezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admin" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant" (
    "id" TEXT NOT NULL,
    "type" "TenantType" NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "documentType" "DocumentType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_membership" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "ClinicRole" NOT NULL DEFAULT 'CLINIC_ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_profile" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialty" (
    "id" TEXT NOT NULL,
    "code" "SpecialtyCode" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "specialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_specialty" (
    "id" TEXT NOT NULL,
    "professionalProfileId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "councilDocument" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_specialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_profile" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_email_key" ON "account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admin_accountId_key" ON "platform_admin"("accountId");

-- CreateIndex
CREATE INDEX "clinic_membership_tenantId_idx" ON "clinic_membership"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_membership_accountId_tenantId_key" ON "clinic_membership"("accountId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "professional_profile_accountId_key" ON "professional_profile"("accountId");

-- CreateIndex
CREATE INDEX "professional_profile_tenantId_idx" ON "professional_profile"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "specialty_code_key" ON "specialty"("code");

-- CreateIndex
CREATE INDEX "professional_specialty_specialtyId_idx" ON "professional_specialty"("specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "professional_specialty_professionalProfileId_specialtyId_key" ON "professional_specialty"("professionalProfileId", "specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_profile_accountId_key" ON "patient_profile"("accountId");

-- AddForeignKey
ALTER TABLE "platform_admin" ADD CONSTRAINT "platform_admin_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_membership" ADD CONSTRAINT "clinic_membership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_membership" ADD CONSTRAINT "clinic_membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profile" ADD CONSTRAINT "professional_profile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_profile" ADD CONSTRAINT "professional_profile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_specialty" ADD CONSTRAINT "professional_specialty_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_specialty" ADD CONSTRAINT "professional_specialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_profile" ADD CONSTRAINT "patient_profile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: catalogo fixo de especialidades da plataforma (D-047). Idempotente.
INSERT INTO "specialty" ("id", "code", "name") VALUES
    ('spec_training', 'TRAINING', 'Treino'),
    ('spec_nutrition', 'NUTRITION', 'Nutricao'),
    ('spec_medicine', 'MEDICINE', 'Medicina')
ON CONFLICT ("code") DO NOTHING;

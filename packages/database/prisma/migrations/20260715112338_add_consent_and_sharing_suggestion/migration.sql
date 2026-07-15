-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'DISMISSED', 'ACTED');

-- CreateTable
CREATE TABLE "consent" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "granteeProfessionalProfileId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sharing_suggestion" (
    "id" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "professionalAId" TEXT NOT NULL,
    "professionalBId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sharing_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_patientProfileId_idx" ON "consent"("patientProfileId");

-- CreateIndex
CREATE INDEX "consent_granteeProfessionalProfileId_status_idx" ON "consent"("granteeProfessionalProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "consent_patientProfileId_granteeProfessionalProfileId_speci_key" ON "consent"("patientProfileId", "granteeProfessionalProfileId", "specialtyId");

-- CreateIndex
CREATE INDEX "sharing_suggestion_patientProfileId_status_idx" ON "sharing_suggestion"("patientProfileId", "status");

-- AddForeignKey
ALTER TABLE "consent" ADD CONSTRAINT "consent_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "patient_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent" ADD CONSTRAINT "consent_granteeProfessionalProfileId_fkey" FOREIGN KEY ("granteeProfessionalProfileId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent" ADD CONSTRAINT "consent_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sharing_suggestion" ADD CONSTRAINT "sharing_suggestion_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "patient_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sharing_suggestion" ADD CONSTRAINT "sharing_suggestion_professionalAId_fkey" FOREIGN KEY ("professionalAId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sharing_suggestion" ADD CONSTRAINT "sharing_suggestion_professionalBId_fkey" FOREIGN KEY ("professionalBId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sharing_suggestion" ADD CONSTRAINT "sharing_suggestion_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

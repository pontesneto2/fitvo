-- CreateEnum
CREATE TYPE "BondStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "patient_invite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "professionalProfileId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bond" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientProfileId" TEXT NOT NULL,
    "professionalProfileId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "status" "BondStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "bond_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_invite_tokenHash_key" ON "patient_invite"("tokenHash");

-- CreateIndex
CREATE INDEX "patient_invite_tenantId_idx" ON "patient_invite"("tenantId");

-- CreateIndex
CREATE INDEX "patient_invite_professionalProfileId_status_idx" ON "patient_invite"("professionalProfileId", "status");

-- CreateIndex
CREATE INDEX "patient_invite_email_idx" ON "patient_invite"("email");

-- CreateIndex
CREATE INDEX "bond_tenantId_idx" ON "bond"("tenantId");

-- CreateIndex
CREATE INDEX "bond_professionalProfileId_status_idx" ON "bond"("professionalProfileId", "status");

-- CreateIndex
CREATE INDEX "bond_patientProfileId_status_idx" ON "bond"("patientProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bond_patientProfileId_professionalProfileId_specialtyId_key" ON "bond"("patientProfileId", "professionalProfileId", "specialtyId");

-- AddForeignKey
ALTER TABLE "patient_invite" ADD CONSTRAINT "patient_invite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_invite" ADD CONSTRAINT "patient_invite_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_invite" ADD CONSTRAINT "patient_invite_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bond" ADD CONSTRAINT "bond_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bond" ADD CONSTRAINT "bond_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "patient_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bond" ADD CONSTRAINT "bond_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bond" ADD CONSTRAINT "bond_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

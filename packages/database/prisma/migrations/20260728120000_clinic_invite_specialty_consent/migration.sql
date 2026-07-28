-- CreateEnum
CREATE TYPE "MedicalSpecialty" AS ENUM ('NUTROLOGIA', 'ENDOCRINOLOGIA');

-- AlterTable
ALTER TABLE "professional_invite" ADD COLUMN     "councilDocument" TEXT,
ADD COLUMN     "councilState" "BrazilianState",
ADD COLUMN     "medicalSpecialty" "MedicalSpecialty",
ADD COLUMN     "specialtyId" TEXT;

-- AlterTable
ALTER TABLE "professional_specialty" ADD COLUMN     "medicalSpecialty" "MedicalSpecialty";

-- CreateIndex
CREATE INDEX "professional_invite_specialtyId_idx" ON "professional_invite"("specialtyId");

-- AddForeignKey
ALTER TABLE "professional_invite" ADD CONSTRAINT "professional_invite_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "specialty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


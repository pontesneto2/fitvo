-- CreateEnum
CREATE TYPE "BrazilianState" AS ENUM ('AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO');

-- CreateEnum
CREATE TYPE "BiologicalSex" AS ENUM ('MALE', 'FEMALE', 'INTERSEX', 'NOT_INFORMED');

-- AlterTable
ALTER TABLE "account" ADD COLUMN     "biologicalSex" "BiologicalSex" NOT NULL DEFAULT 'NOT_INFORMED',
ADD COLUMN     "birthDate" DATE;

-- AlterTable
ALTER TABLE "professional_specialty" ADD COLUMN     "councilState" "BrazilianState",
ADD COLUMN     "rqe" TEXT;

-- AlterTable
ALTER TABLE "tenant" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressComplement" TEXT,
ADD COLUMN     "addressDistrict" TEXT,
ADD COLUMN     "addressNumber" TEXT,
ADD COLUMN     "addressState" "BrazilianState",
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "addressZipCode" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "logoStorageKey" TEXT,
ADD COLUMN     "phone" TEXT;

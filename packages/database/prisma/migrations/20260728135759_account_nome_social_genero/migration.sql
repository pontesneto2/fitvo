-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MULHER_CIS', 'HOMEM_CIS', 'MULHER_TRANS', 'HOMEM_TRANS', 'NAO_BINARIO', 'OUTRO', 'PREFIRO_NAO_INFORMAR');

-- AlterTable
ALTER TABLE "account" ADD COLUMN     "gender" "Gender",
ADD COLUMN     "socialName" TEXT;

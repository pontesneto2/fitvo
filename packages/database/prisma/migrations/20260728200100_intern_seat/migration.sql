-- Seat de ESTAGIARIO supervisionado (D-142). ADITIVA: so cria tabelas novas,
-- nao remove nem altera coluna existente.
--
-- `supervisorProfessionalProfileId` e NOT NULL nas DUAS tabelas: "estagiario sem
-- responsavel" e estado invalido IRREPRESENTAVEL, nao regra de aplicacao. FK com
-- ON DELETE RESTRICT: o responsavel nao pode ser apagado por baixo do estagiario.

-- CreateTable
CREATE TABLE "intern_profile" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supervisorProfessionalProfileId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "intern_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intern_invite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "supervisorProfessionalProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "intern_invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intern_profile_accountId_key" ON "intern_profile"("accountId");

-- CreateIndex
CREATE INDEX "intern_profile_tenantId_idx" ON "intern_profile"("tenantId");

-- CreateIndex
CREATE INDEX "intern_profile_supervisorProfessionalProfileId_idx" ON "intern_profile"("supervisorProfessionalProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "intern_invite_tokenHash_key" ON "intern_invite"("tokenHash");

-- CreateIndex
CREATE INDEX "intern_invite_tenantId_idx" ON "intern_invite"("tenantId");

-- CreateIndex
CREATE INDEX "intern_invite_tenantId_status_idx" ON "intern_invite"("tenantId", "status");

-- CreateIndex
CREATE INDEX "intern_invite_supervisorProfessionalProfileId_idx" ON "intern_invite"("supervisorProfessionalProfileId");

-- AddForeignKey
ALTER TABLE "intern_profile" ADD CONSTRAINT "intern_profile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intern_profile" ADD CONSTRAINT "intern_profile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intern_profile" ADD CONSTRAINT "intern_profile_supervisorProfessionalProfileId_fkey" FOREIGN KEY ("supervisorProfessionalProfileId") REFERENCES "professional_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intern_invite" ADD CONSTRAINT "intern_invite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intern_invite" ADD CONSTRAINT "intern_invite_supervisorProfessionalProfileId_fkey" FOREIGN KEY ("supervisorProfessionalProfileId") REFERENCES "professional_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


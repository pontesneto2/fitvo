-- CreateTable
CREATE TABLE "reception_profile" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reception_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reception_invite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reception_invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reception_profile_accountId_key" ON "reception_profile"("accountId");

-- CreateIndex
CREATE INDEX "reception_profile_tenantId_idx" ON "reception_profile"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "reception_invite_tokenHash_key" ON "reception_invite"("tokenHash");

-- CreateIndex
CREATE INDEX "reception_invite_tenantId_idx" ON "reception_invite"("tenantId");

-- CreateIndex
CREATE INDEX "reception_invite_tenantId_status_idx" ON "reception_invite"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "reception_profile" ADD CONSTRAINT "reception_profile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception_profile" ADD CONSTRAINT "reception_profile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception_invite" ADD CONSTRAINT "reception_invite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


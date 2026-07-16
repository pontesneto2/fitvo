-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ProfessionalServiceType" AS ENUM ('FIRST_VISIT', 'RETURN', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'APPOINTMENT_CONFIRMATION';

-- AlterTable
ALTER TABLE "encounter" ADD COLUMN     "appointmentId" TEXT;

-- CreateTable
CREATE TABLE "professional_service" (
    "id" TEXT NOT NULL,
    "professionalSpecialtyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "type" "ProfessionalServiceType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "professional_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_agenda_settings" (
    "id" TEXT NOT NULL,
    "professionalProfileId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "reminderHoursBefore" INTEGER[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "professional_agenda_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rule" (
    "id" TEXT NOT NULL,
    "professionalProfileId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "availability_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_exception" (
    "id" TEXT NOT NULL,
    "professionalProfileId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "availability_exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bondId" TEXT NOT NULL,
    "professionalProfileId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "priceCentsAtBooking" INTEGER NOT NULL,
    "serviceTypeAtBooking" "ProfessionalServiceType" NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "professional_service_professionalSpecialtyId_active_idx" ON "professional_service"("professionalSpecialtyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "professional_agenda_settings_professionalProfileId_key" ON "professional_agenda_settings"("professionalProfileId");

-- CreateIndex
CREATE INDEX "availability_rule_professionalProfileId_weekday_idx" ON "availability_rule"("professionalProfileId", "weekday");

-- CreateIndex
CREATE INDEX "availability_exception_professionalProfileId_startsAt_idx" ON "availability_exception"("professionalProfileId", "startsAt");

-- CreateIndex
CREATE INDEX "appointment_professionalProfileId_startsAt_idx" ON "appointment"("professionalProfileId", "startsAt");

-- CreateIndex
CREATE INDEX "appointment_bondId_startsAt_idx" ON "appointment"("bondId", "startsAt");

-- CreateIndex
CREATE INDEX "appointment_tenantId_startsAt_idx" ON "appointment"("tenantId", "startsAt");

-- CreateIndex
CREATE INDEX "appointment_status_startsAt_idx" ON "appointment"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "bond_id_professionalProfileId_key" ON "bond"("id", "professionalProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "encounter_appointmentId_key" ON "encounter"("appointmentId");

-- AddForeignKey
ALTER TABLE "encounter" ADD CONSTRAINT "encounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_service" ADD CONSTRAINT "professional_service_professionalSpecialtyId_fkey" FOREIGN KEY ("professionalSpecialtyId") REFERENCES "professional_specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_agenda_settings" ADD CONSTRAINT "professional_agenda_settings_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rule" ADD CONSTRAINT "availability_rule_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_exception" ADD CONSTRAINT "availability_exception_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_bondId_professionalProfileId_fkey" FOREIGN KEY ("bondId", "professionalProfileId") REFERENCES "bond"("id", "professionalProfileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "professional_service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- =============================================================================
-- Deteccao de conflito de agendamento (D-106 — ADR-0012)
-- =============================================================================
-- SQL CRU porque o Prisma nao expressa EXCLUDE. Nao e preferencia: e a unica
-- forma de fechar a corrida.
--
-- POR QUE NO BANCO E NAO NA APLICACAO: a checagem "esta livre?" seguida de INSERT
-- tem TOCTOU — dois agendamentos simultaneos consultam, ambos passam, ambos
-- inserem. Overbooking e exatamente o que o ADR-0012 existe para evitar, e nasceria
-- de uma corrida, nao de um bug de logica.
--
-- POR QUE AQUI VALE E NO ADR-0011 NAO VALEU: la o trigger de autoria foi rejeitado
-- porque VE LINHAS, NAO SESSOES — a pergunta era "quem estava autenticado?". Aqui
-- a pergunta E linhas: "estes dois intervalos se sobrepoem?". Fato fisico, sem
-- sessao e sem politica de negocio que evolua. O argumento nao transfere.
--
-- CONSEQUENCIA ACEITA: esta constraint e INVISIVEL ao `migrate diff` nos dois
-- sentidos (verificado: diff=0 com ela presente no shadow). Nao quebra o job
-- `migrate` — e o job tambem NAO a protege. Se alguem a derrubar, o CI nao percebe.
-- A compensacao e o teste de integracao que a exercita (dois agendamentos
-- sobrepostos; o segundo falha). Se a constraint sumir, o TESTE quebra.
--
-- Só SCHEDULED/CONFIRMED ocupam a agenda: cancelado, concluido e no-show liberam o
-- horario para remarcacao.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "appointment"
  ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    "professionalProfileId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE (status IN ('SCHEDULED', 'CONFIRMED'));

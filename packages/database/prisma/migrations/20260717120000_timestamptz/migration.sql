-- =============================================================================
-- timestamp(3) -> timestamptz(3) em todas as tabelas (D-067/D-111)
-- =============================================================================
-- O D-067/D-111 decidem "tudo em UTC". O Prisma mapeia DateTime para
-- `timestamp(3)` SEM fuso: a coluna guardava UTC sem SABER que era UTC —
-- convencao por esperanca, que funciona enquanto todo mundo lembrar.
--
-- O BURACO ERA O DEFAULT, NAO O CLIENT. O caminho do Prisma Client e seguro: ele
-- manda literal, sem conversao. Quem calculava errado era o BANCO, nas 56 colunas
-- com `DEFAULT CURRENT_TIMESTAMP` — `CURRENT_TIMESTAMP` devolve timestamptz, e
-- atribui-lo a uma coluna sem fuso converte usando o fuso da SESSAO. Verificado:
-- dois INSERT a ~1ms de distancia, um com a sessao em UTC e outro em
-- America/Sao_Paulo, gravavam valores 3h diferentes. Sem erro nenhum. Mais o SQL
-- cru/psql/BI e qualquer consumidor futuro que nao seja o Prisma.
--
-- POR QUE AGORA: nao e o risco, e a JANELA. Com o banco vazio esta conversao e
-- instantanea e TRIVIALMENTE correta. Com dados, alem do rewrite com lock em 54
-- tabelas, ela vira uma APOSTA de que nenhuma sessao jamais escreveu em fuso
-- local — e a certeza que existe hoje nao volta.
--
-- O `USING ... AT TIME ZONE 'UTC'` NAO E ENFEITE. O Prisma gera o ALTER SEM ele, e
-- sem USING o Postgres interpreta o valor existente como hora LOCAL DA SESSAO.
-- Verificado: um valor gravado como 14:00 UTC, migrado numa sessao em
-- America/Sao_Paulo, VIRA 17:00 UTC — 3h de corrupcao, silenciosa. Com o USING,
-- fica 14:00 em qualquer sessao.
--
-- E ele DECLARA a premissa em vez de assumi-la: "o que esta gravado aqui E UTC" —
-- exatamente o que o D-111 afirma. A migracao passa a ser a afirmacao.
-- =============================================================================

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "emailVerifiedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "emailVerifiedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis" ALTER COLUMN "answeredAt" SET DATA TYPE TIMESTAMPTZ(3) USING "answeredAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_allergy" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_clinical_history" ALTER COLUMN "authoredAt" SET DATA TYPE TIMESTAMPTZ(3) USING "authoredAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_condition" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_emergency_contact" ALTER COLUMN "authoredAt" SET DATA TYPE TIMESTAMPTZ(3) USING "authoredAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_family_condition" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_family_history" ALTER COLUMN "authoredAt" SET DATA TYPE TIMESTAMPTZ(3) USING "authoredAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_goal" ALTER COLUMN "authoredAt" SET DATA TYPE TIMESTAMPTZ(3) USING "authoredAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_injury" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_lifestyle" ALTER COLUMN "authoredAt" SET DATA TYPE TIMESTAMPTZ(3) USING "authoredAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_medication" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_parq" ALTER COLUMN "authoredAt" SET DATA TYPE TIMESTAMPTZ(3) USING "authoredAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_surgery" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "anamnesis_training" ALTER COLUMN "authoredAt" SET DATA TYPE TIMESTAMPTZ(3) USING "authoredAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "assessment" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "lastMessageAt" SET DATA TYPE TIMESTAMPTZ(3) USING "lastMessageAt" AT TIME ZONE 'UTC',
ALTER COLUMN "resolvedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "resolvedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "attendance_message" ALTER COLUMN "readAt" SET DATA TYPE TIMESTAMPTZ(3) USING "readAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "attendance_rating" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "bond" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "archivedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "archivedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "charge" ALTER COLUMN "dueDate" SET DATA TYPE TIMESTAMPTZ(3) USING "dueDate" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "clinic_membership" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "consent" ALTER COLUMN "grantedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "grantedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "revokedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "revokedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "encounter" ALTER COLUMN "occurredAt" SET DATA TYPE TIMESTAMPTZ(3) USING "occurredAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "exercise" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "food" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "form_analysis" ALTER COLUMN "reviewedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "reviewedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "meal_plan" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "meal_plan_item" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "medical_record" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "notification" ALTER COLUMN "readAt" SET DATA TYPE TIMESTAMPTZ(3) USING "readAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "patient_invite" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "patient_profile" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "lastCadastralReviewAt" SET DATA TYPE TIMESTAMPTZ(3) USING "lastCadastralReviewAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "payment_account" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "plan" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "plan_price" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "platform_admin" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "prescription" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "professional_invite" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "professional_profile" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "professional_specialty" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "progress_photo" ALTER COLUMN "takenAt" SET DATA TYPE TIMESTAMPTZ(3) USING "takenAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "set_log" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "sharing_suggestion" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "subscription" ALTER COLUMN "currentPeriodEnd" SET DATA TYPE TIMESTAMPTZ(3) USING "currentPeriodEnd" AT TIME ZONE 'UTC',
ALTER COLUMN "trialEndsAt" SET DATA TYPE TIMESTAMPTZ(3) USING "trialEndsAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "tenant" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "webhook_event" ALTER COLUMN "processedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "processedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "workout" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "workout_item" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "workout_plan" ALTER COLUMN "validUntil" SET DATA TYPE TIMESTAMPTZ(3) USING "validUntil" AT TIME ZONE 'UTC',
ALTER COLUMN "releaseAt" SET DATA TYPE TIMESTAMPTZ(3) USING "releaseAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "workout_rating" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "workout_session" ALTER COLUMN "performedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "performedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "completedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "completedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "workout_set" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';


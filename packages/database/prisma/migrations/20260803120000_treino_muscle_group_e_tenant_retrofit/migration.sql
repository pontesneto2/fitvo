-- Dominio de treino — Bloco 1: taxonomia de grupo muscular (D-164) + retrofit de
-- tenantId (D-166) — ADR-0009 / ADR-0017.
--
-- ADITIVA E FORWARD-ONLY: nao remove nem altera nenhuma coluna com dado
-- existente. Toda coluna NOT NULL nova entra em TRES passos — ADD nulavel,
-- BACKFILL a partir da FK do pai (ou do seed), SET NOT NULL — para que a
-- migration aplique num banco COM dado sem quebrar. Nenhum DROP/TRUNCATE/DELETE.
--
-- RLS: as tabelas de treino NAO entram na leva de RLS (D-152 — ADR-0017 as
-- deixou de fora de proposito: e dado operacional/fitness, nao o sigilo medico
-- que motivou a Camada 3). Esta migration nao cria policy nenhuma.

-- ============================================================================
-- 1. MuscleGroup — catalogo GLOBAL de grupo muscular (D-164)
-- ============================================================================
-- Tabela-pai, nao enum: adicionar/renomear grupo e INSERT, nao migration. Sem
-- coluna tenantId (bucket B, padrao de `specialty`): o catalogo e o mesmo para
-- todo tenant.
CREATE TABLE "muscle_group" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "LibraryItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "muscle_group_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "muscle_group_code_key" ON "muscle_group"("code");
CREATE INDEX "muscle_group_status_displayOrder_idx" ON "muscle_group"("status", "displayOrder");

-- Seed do catalogo inicial (mesmo padrao do seed de `specialty`: id estavel +
-- ON CONFLICT DO NOTHING, para a migration ser reaplicavel sem duplicar). O
-- `name` e so o fallback pt-BR — o label exibido vive no i18n (D-066).
INSERT INTO "muscle_group" ("id", "code", "name", "displayOrder", "updatedAt") VALUES
    ('mg_peito',          'PEITO',          'Peito',             10, CURRENT_TIMESTAMP),
    ('mg_costas',         'COSTAS',         'Costas',            20, CURRENT_TIMESTAMP),
    ('mg_ombro',          'OMBRO',          'Ombro',             30, CURRENT_TIMESTAMP),
    ('mg_trapezio',       'TRAPEZIO',       'Trapezio',          40, CURRENT_TIMESTAMP),
    ('mg_biceps',         'BICEPS',         'Biceps',            50, CURRENT_TIMESTAMP),
    ('mg_triceps',        'TRICEPS',        'Triceps',           60, CURRENT_TIMESTAMP),
    ('mg_antebraco',      'ANTEBRACO',      'Antebraco',         70, CURRENT_TIMESTAMP),
    ('mg_abdomen',        'ABDOMEN',        'Abdomen',           80, CURRENT_TIMESTAMP),
    ('mg_lombar',         'LOMBAR',         'Lombar',            90, CURRENT_TIMESTAMP),
    ('mg_quadriceps',     'QUADRICEPS',     'Quadriceps',       100, CURRENT_TIMESTAMP),
    ('mg_posterior_coxa', 'POSTERIOR_COXA', 'Posterior de coxa',110, CURRENT_TIMESTAMP),
    ('mg_gluteo',         'GLUTEO',         'Gluteo',           120, CURRENT_TIMESTAMP),
    ('mg_adutores',       'ADUTORES',       'Adutores',         130, CURRENT_TIMESTAMP),
    ('mg_abdutores',      'ABDUTORES',      'Abdutores',        140, CURRENT_TIMESTAMP),
    ('mg_panturrilha',    'PANTURRILHA',    'Panturrilha',      150, CURRENT_TIMESTAMP),
    ('mg_corpo_inteiro',  'CORPO_INTEIRO',  'Corpo inteiro',    160, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- ============================================================================
-- 2. Exercise — grupo primario/secundarios (D-164), tenantId (D-166),
--    nameNormalized (D-169)
-- ============================================================================
CREATE TABLE "exercise_secondary_muscle_group" (
    "exerciseId" TEXT NOT NULL,
    "muscleGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_secondary_muscle_group_pkey" PRIMARY KEY ("exerciseId","muscleGroupId")
);

CREATE INDEX "exercise_secondary_muscle_group_muscleGroupId_idx" ON "exercise_secondary_muscle_group"("muscleGroupId");

ALTER TABLE "exercise_secondary_muscle_group" ADD CONSTRAINT "exercise_secondary_muscle_group_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercise_secondary_muscle_group" ADD CONSTRAINT "exercise_secondary_muscle_group_muscleGroupId_fkey" FOREIGN KEY ("muscleGroupId") REFERENCES "muscle_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- `tenantId` NULAVEL de proposito: NULL = item PLATFORM, global, visivel a todos
-- os tenants (D-089). Nao e "coluna faltando" — e o que mantem a biblioteca
-- compartilhada viva. Por isso `exercise` NAO entra em TENANT_SCOPED_MODELS
-- (ver tenant-isolation-extension.ts).
ALTER TABLE "exercise" ADD COLUMN "tenantId" TEXT;

-- As duas NOT NULL entram nulaveis para o backfill abaixo.
ALTER TABLE "exercise" ADD COLUMN "primaryMuscleGroupId" TEXT;
ALTER TABLE "exercise" ADD COLUMN "nameNormalized" TEXT;

-- Backfill do nome normalizado (D-169). Espelha `normalizeLibraryItemName`
-- (packages/database/src/normalize-library-item-name.ts), que e a fonte canonica
-- usada em runtime: sem acento, minusculo, separadores (espaco/hifen/underline)
-- colapsados num espaco, aparado. `translate` cobre o conjunto pt-BR em vez de
-- exigir a extensao `unaccent` (que nem todo ambiente tem provisionada); a
-- versao JS usa decomposicao Unicode e cobre mais, mas este backfill roda UMA
-- VEZ, so sobre linha pre-existente.
UPDATE "exercise"
SET "nameNormalized" = btrim(
    regexp_replace(
        lower(translate(
            "name",
            'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
            'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
        )),
        '[[:space:]_-]+', ' ', 'g'
    )
);

-- Backfill do grupo primario. Linha PRE-EXISTENTE nao tem taxonomia (a coluna
-- acabou de nascer), entao recebe CORPO_INTEIRO — que e um grupo LEGITIMO do
-- catalogo (burpee, agachamento), nao um sentinela inventado. Deliberado e
-- seguro aqui porque nao ha producao: as unicas linhas de `exercise` hoje sao
-- residuo de teste de integracao em dev. Item novo nasce com o grupo escolhido
-- pelo profissional (obrigatorio no contrato de criacao).
UPDATE "exercise"
SET "primaryMuscleGroupId" = 'mg_corpo_inteiro'
WHERE "primaryMuscleGroupId" IS NULL;

ALTER TABLE "exercise" ALTER COLUMN "nameNormalized" SET NOT NULL;
ALTER TABLE "exercise" ALTER COLUMN "primaryMuscleGroupId" SET NOT NULL;

CREATE INDEX "exercise_tenantId_idx" ON "exercise"("tenantId");
CREATE INDEX "exercise_primaryMuscleGroupId_idx" ON "exercise"("primaryMuscleGroupId");
CREATE INDEX "exercise_nameNormalized_idx" ON "exercise"("nameNormalized");

ALTER TABLE "exercise" ADD CONSTRAINT "exercise_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exercise" ADD CONSTRAINT "exercise_primaryMuscleGroupId_fkey" FOREIGN KEY ("primaryMuscleGroupId") REFERENCES "muscle_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 3. Retrofit de tenantId nos filhos de dado de vinculo (D-166)
-- ============================================================================
-- Estas quatro ja eram escopadas TRANSITIVAMENTE pela FK do pai. Com coluna
-- propria, a extension de isolamento passa a injetar o filtro sozinha (Camada 2)
-- em vez de depender de o app lembrar de validar o pai. NOT NULL: nao existe
-- prescricao/execucao sem tenant (ao contrario de `exercise`, que tem a base
-- global). Backfill sempre a partir do pai — nunca um valor arbitrario.

-- workout_item <- workout
ALTER TABLE "workout_item" ADD COLUMN "tenantId" TEXT;
UPDATE "workout_item" AS wi
SET "tenantId" = w."tenantId"
FROM "workout" AS w
WHERE w."id" = wi."workoutId";
ALTER TABLE "workout_item" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "workout_item_tenantId_idx" ON "workout_item"("tenantId");
ALTER TABLE "workout_item" ADD CONSTRAINT "workout_item_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- workout_set <- workout_item (depende do backfill acima ja ter rodado)
ALTER TABLE "workout_set" ADD COLUMN "tenantId" TEXT;
UPDATE "workout_set" AS ws
SET "tenantId" = wi."tenantId"
FROM "workout_item" AS wi
WHERE wi."id" = ws."workoutItemId";
ALTER TABLE "workout_set" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "workout_set_tenantId_idx" ON "workout_set"("tenantId");
ALTER TABLE "workout_set" ADD CONSTRAINT "workout_set_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- set_log <- workout_session
ALTER TABLE "set_log" ADD COLUMN "tenantId" TEXT;
UPDATE "set_log" AS sl
SET "tenantId" = wsn."tenantId"
FROM "workout_session" AS wsn
WHERE wsn."id" = sl."sessionId";
ALTER TABLE "set_log" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "set_log_tenantId_idx" ON "set_log"("tenantId");
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- workout_rating <- workout_session
ALTER TABLE "workout_rating" ADD COLUMN "tenantId" TEXT;
UPDATE "workout_rating" AS wr
SET "tenantId" = wsn."tenantId"
FROM "workout_session" AS wsn
WHERE wsn."id" = wr."sessionId";
ALTER TABLE "workout_rating" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE INDEX "workout_rating_tenantId_idx" ON "workout_rating"("tenantId");
ALTER TABLE "workout_rating" ADD CONSTRAINT "workout_rating_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

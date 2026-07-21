-- CreateEnum
CREATE TYPE "TermsDocumentSlug" AS ENUM ('TERMS_OF_USE', 'PRIVACY_POLICY');

-- CreateEnum
CREATE TYPE "TermsAcceptanceEventType" AS ENUM ('ACCEPTED', 'REVOKED');

-- CreateTable
CREATE TABLE "terms_document" (
    "id" TEXT NOT NULL,
    "slug" "TermsDocumentSlug" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "terms_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms_version" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isMaterialChange" BOOLEAN NOT NULL,
    "changeSummary" TEXT,
    "contentHash" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms_acceptance_event" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "termsVersionId" TEXT NOT NULL,
    "type" "TermsAcceptanceEventType" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_acceptance_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terms_document_slug_key" ON "terms_document"("slug");

-- CreateIndex
CREATE INDEX "terms_version_documentId_publishedAt_idx" ON "terms_version"("documentId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "terms_version_documentId_version_key" ON "terms_version"("documentId", "version");

-- CreateIndex
CREATE INDEX "terms_acceptance_event_accountId_termsVersionId_idx" ON "terms_acceptance_event"("accountId", "termsVersionId");

-- AddForeignKey
ALTER TABLE "terms_version" ADD CONSTRAINT "terms_version_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "terms_document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms_acceptance_event" ADD CONSTRAINT "terms_acceptance_event_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms_acceptance_event" ADD CONSTRAINT "terms_acceptance_event_termsVersionId_fkey" FOREIGN KEY ("termsVersionId") REFERENCES "terms_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: catalogo fixo de documentos de termos da plataforma (D-025), mesmo
-- padrao de "specialty" (D-047). Idempotente. O conteudo/hash real do texto
-- juridico e input GATED (aguarda o time juridico/produto — ver roadmap); o
-- contentHash abaixo e um PLACEHOLDER (sha256 de string vazia) so para
-- satisfazer a coluna NOT NULL ate o texto real ser publicado (repovoando
-- estas duas linhas via migration/seed proprios quando o conteudo existir).
INSERT INTO "terms_document" ("id", "slug", "updatedAt") VALUES
    ('terms_doc_tou', 'TERMS_OF_USE', CURRENT_TIMESTAMP),
    ('terms_doc_pp', 'PRIVACY_POLICY', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "terms_version"
    ("id", "documentId", "version", "isMaterialChange", "changeSummary", "contentHash", "publishedAt")
VALUES
    (
        'terms_ver_tou_v1',
        'terms_doc_tou',
        '1.0.0',
        true,
        'Versao inicial dos Termos de Uso.',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        '2026-01-01 00:00:00+00'
    ),
    (
        'terms_ver_pp_v1',
        'terms_doc_pp',
        '1.0.0',
        true,
        'Versao inicial da Politica de Privacidade.',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        '2026-01-01 00:00:00+00'
    )
ON CONFLICT ("documentId", "version") DO NOTHING;

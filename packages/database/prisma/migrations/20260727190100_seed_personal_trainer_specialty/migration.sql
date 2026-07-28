-- Seed do catalogo fixo de especialidades (D-047) — mesmo padrao do INSERT
-- original em `init_identity`. Personal Trainer usa o mesmo conselho (CREF)
-- de TRAINING; sem RQE (so cabe em MEDICINE) e sem segunda especialidade
-- medica (fora de escopo deste slice).
INSERT INTO "specialty" ("id", "code", "name") VALUES
    ('spec_personal_trainer', 'PERSONAL_TRAINER', 'Personal Trainer')
ON CONFLICT ("code") DO NOTHING;

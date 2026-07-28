-- AlterEnum
-- Personal Trainer como 4a especialidade do catalogo (D-047) — aditivo, nao
-- altera/remove os 3 valores existentes. Separado do INSERT do catalogo
-- (migration seguinte) de proposito: Postgres nao permite usar um valor de
-- enum recem-adicionado na MESMA transacao em que foi adicionado — cada
-- arquivo de migration do Prisma roda em sua propria transacao, entao a
-- ALTER TYPE precisa ter COMMITADO antes do INSERT que a referencia.

ALTER TYPE "SpecialtyCode" ADD VALUE 'PERSONAL_TRAINER';

-- Dominio de treino — Bloco 2 (prescricao): PLANO FIXO (D-105 — ADR-0009).
--
-- ADITIVA E FORWARD-ONLY: duas colunas NOVAS em `workout_plan`, ambas com
-- default. Nenhuma coluna existente e removida ou alterada; nenhum
-- DROP/TRUNCATE/DELETE. Aplica num banco COM dado sem backfill manual — o
-- default cobre as linhas existentes (todo plano ja gravado e variavel).
--
-- Por que duas colunas e nao um valor novo em `PlanOrganization`: o plano fixo
-- e EIXO PROPRIO (D-105) — ele continua sendo A/B/C ou por dia por dentro; o
-- que muda e que ele roda POR CIMA dos demais em vez de competir pelo tempo do
-- aluno (D-079). Colar isso em `organization` colapsaria duas perguntas
-- diferentes ("como se organiza" x "compete ou nao") numa coluna so.
--
-- `fixedWeekdays` vazio = vale TODO DIA (D-105). Enum `Weekday` (ja existente)
-- em vez de Int 1..7: dia invalido irrepresentavel.

ALTER TABLE "workout_plan" ADD COLUMN "isFixed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workout_plan" ADD COLUMN "fixedWeekdays" "Weekday"[] DEFAULT ARRAY[]::"Weekday"[];
